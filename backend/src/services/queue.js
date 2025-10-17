// services/queue.js
const { setTimeout: wait } = require("timers/promises");
const wa = require("./wa");
const MessageLog = require("../models/MessageLog");
const Blast = require("../models/Blast");

class SendQueue {
  constructor() {
    this.queue = [];
    this.running = false;
    this.sentCount = 0; // counter global untuk pauseEvery
    this.lastBlastId = null;
  }

  addJob(job) {
    this.queue.push(job);
    this.process();
  }

  async process() {
    if (this.running) return;
    this.running = true;

    while (this.queue.length) {
      const job = this.queue.shift();

      // reset counter per blast
      if (this.lastBlastId !== job.blastId) {
        this.lastBlastId = job.blastId;
        this.sentCount = 0;
      }

      try {
        // =========================
        // 🔥 Cek status Blast (awal)
        // =========================
        const blast = await Blast.findById(job.blastId);
        if (!blast) {
          console.log(`[QUEUE] Blast ${job.blastId} tidak ditemukan, skip job.`);
          continue;
        }

        if (blast.status === "paused") {
          console.log(`[QUEUE] Blast ${job.blastId} sedang dijeda. Job ditahan.`);
          this.queue.unshift(job); // balikin job ke depan antrian
          await wait(3000); // cek ulang 3 detik sekali
          continue;
        }

        if (blast.status === "stopped" || blast.status === "cancelled") {
          console.log(`[QUEUE] Blast ${job.blastId} sudah dihentikan. Job dibuang.`);
          continue;
        }

        // =========================
        // 🔥 Tentukan delay
        // =========================
        let delayMs = 2000; // default 2 detik
        if (job.delay?.mode === "random") {
          const min = job.delay.min || 2;
          const max = job.delay.max || 6;
          delayMs = (Math.floor(Math.random() * (max - min + 1)) + min) * 1000;
        } else if (job.delay?.mode === "fixed") {
          delayMs = (job.delay.value || 5) * 1000;
        } else {
          delayMs = 1500 + Math.floor(Math.random() * 2500);
        }

        console.log(`⏳ [QUEUE] Delay ${delayMs / 1000}s sebelum kirim ke ${job.to}`);
        await wait(delayMs);

        // 🔥 Cek ulang status Blast setelah delay (extra guard)
        const freshBlast = await Blast.findById(job.blastId);
        if (!freshBlast || ["stopped", "cancelled"].includes(freshBlast.status)) {
          await MessageLog.findByIdAndUpdate(job.logId, {
            status: "cancelled",
            updatedAt: new Date(),
          });

          await Blast.updateOne(
            { _id: job.blastId, "recipients.phone": job.to },
            { $set: { "recipients.$.status": "cancelled" } }
          );

          console.log(`[QUEUE] Job dibatalkan, blast ${job.blastId} dihentikan setelah delay.`);
          continue;
        }

        // =========================
        // Eksekusi kirim WA
        // =========================

        // 🔥 cek lagi status sebelum benar2 kirim
        const latestBlast = await Blast.findById(job.blastId);
        if (!latestBlast || ["stopped", "cancelled"].includes(latestBlast.status)) {
          await MessageLog.findByIdAndUpdate(job.logId, {
            status: "cancelled",
            updatedAt: new Date(),
          });

          await Blast.updateOne(
            { _id: job.blastId, "recipients.phone": job.to },
            { $set: { "recipients.$.status": "cancelled" } }
          );

          console.log(`[QUEUE] Job dibatalkan persis sebelum kirim ke ${job.to}`);
          continue;
        }

        const result = await wa.processJob(job);

        // Sukses → update MessageLog & Blast
        await MessageLog.findByIdAndUpdate(job.logId, {
          status: "sent",
          providerId: result?.providerId || null,
          updatedAt: new Date(),
        });

        await Blast.updateOne(
          { _id: job.blastId, "recipients.phone": job.to },
          {
            $set: {
              "recipients.$.status": "sent",
              "recipients.$.waMsgId": result?.providerId || null,
              "recipients.$.timestamps.sentAt": new Date(),
            },
            $inc: { "totals.sent": 1 },
          }
        );

        // =========================
        // 🔥 PauseEvery check (anti ban)
        // =========================
        this.sentCount++;
        if (job.pauseEvery && job.pauseDuration) {
          if (this.sentCount % job.pauseEvery === 0) {
            console.log(`⏸️ [QUEUE] Pause ${job.pauseDuration}s setelah ${this.sentCount} pesan`);
            await wait(job.pauseDuration * 1000);
          }
        }

      } catch (err) {
        console.error("❌ Queue job failed:", err);

        // Gagal → update MessageLog & Blast
        await MessageLog.findByIdAndUpdate(job.logId, {
          status: "failed",
          error: String(err?.message || err),
          updatedAt: new Date(),
        });

        await Blast.updateOne(
          { _id: job.blastId, "recipients.phone": job.to },
          {
            $set: {
              "recipients.$.status": "failed",
              "recipients.$.error": {
                code: "SEND_ERR",
                message: String(err?.message || err),
              },
              "recipients.$.timestamps.failedAt": new Date(),
            },
            $inc: { "totals.failed": 1 },
          }
        );
      }
    }

    this.running = false;
  }
}

module.exports = new SendQueue();