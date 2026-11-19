package com.wehdathub

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.util.Log
import android.provider.OpenableColumns
import java.io.File
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicInteger

/** What another app (WhatsApp, Gallery, Files) shared into this one, copied into the app's cache so it stays readable. */
object ShareStore {
  data class Item(val uri: String, val mimeType: String, val name: String)

  @Volatile var text: String? = null
  @Volatile var files: List<Item> = emptyList()
  /** True when a shared file was refused for being over [MAX_BYTES] (JS says so in words). */
  @Volatile var tooBig: Boolean = false

  private const val MAX_BYTES = 1024L * 1024 * 1024
  private val executor = Executors.newSingleThreadExecutor()
  private val pendingCount = AtomicInteger(0)

  /** True while a share is still being copied in the background; JS waits and asks again. */
  val pending: Boolean get() = pendingCount.get() > 0

  fun clear() {
    // A copy in progress will publish its own result; only a finished share is cleared.
    if (pending) return
    text = null
    files = emptyList()
    tooBig = false
  }

  /** The size the provider reports, or -1 when it does not say. Asked before any copy. */
  private fun sizeOf(context: Context, uri: Uri): Long =
    try {
      context.contentResolver.query(uri, arrayOf(OpenableColumns.SIZE), null, null, null)?.use { c ->
        if (c.moveToFirst() && !c.isNull(0)) c.getLong(0) else -1L
      } ?: -1L
    } catch (_: Exception) {
      -1L
    }

  @Suppress("DEPRECATION")
  private fun displayName(context: Context, uri: Uri): String? =
    try {
      context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { c ->
        if (c.moveToFirst()) c.getString(0) else null
      }
    } catch (_: Exception) {
      null
    }

  /** A zip starts with "PK" and 03 04 (a file), 05 06 (empty) or 07 08 (spanned). */
  private fun isZip(file: File): Boolean =
    try {
      val head = ByteArray(4)
      val n = file.inputStream().use { it.read(head) }
      n == 4 && head[0] == 0x50.toByte() && head[1] == 0x4B.toByte() &&
        ((head[2] == 3.toByte() && head[3] == 4.toByte()) || (head[2] == 5.toByte() && head[3] == 6.toByte()) || (head[2] == 7.toByte() && head[3] == 8.toByte()))
    } catch (_: Exception) {
      false
    }

  @Suppress("DEPRECATION")
  private fun streamUri(intent: Intent): Uri? =
    if (Build.VERSION.SDK_INT >= 33) intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
    else intent.getParcelableExtra<Uri>(Intent.EXTRA_STREAM)

  @Suppress("DEPRECATION")
  private fun streamUris(intent: Intent): List<Uri> =
    (if (Build.VERSION.SDK_INT >= 33) intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM, Uri::class.java)
    else intent.getParcelableArrayListExtra<Uri>(Intent.EXTRA_STREAM)) ?: emptyList()

  /** Copies the shared file into [target]; the read is inside try so a revoked or missing grant is logged, not thrown. */
  private fun copyTo(context: Context, uri: Uri, target: File): Boolean =
    try {
      val input = context.contentResolver.openInputStream(uri)
      if (input == null) {
        Log.w("ShareStore", "openInputStream returned null for $uri")
        false
      } else {
        input.use { i -> target.outputStream().use { i.copyTo(it) } }
        true
      }
    } catch (e: Exception) {
      Log.w("ShareStore", "could not read shared file $uri", e)
      false
    }

  fun handle(context: Context, intent: Intent?) {
    if (intent == null) return
    val action = intent.action
    if (action != Intent.ACTION_SEND && action != Intent.ACTION_SEND_MULTIPLE) return
    val sharedText = intent.getStringExtra(Intent.EXTRA_TEXT)
    val uris = ArrayList<Uri>()
    if (action == Intent.ACTION_SEND) streamUri(intent)?.let { uris.add(it) } else uris.addAll(streamUris(intent))
    // Some apps put the file only in the clip data, not in EXTRA_STREAM.
    if (uris.isEmpty()) {
      val clip = intent.clipData
      if (clip != null) for (i in 0 until clip.itemCount) clip.getItemAt(i).uri?.let { if (it !in uris) uris.add(it) }
    }
    val appContext = context.applicationContext
    // This intent is handled: a later app resume must not process it again.
    intent.action = null
    val mimeHint = intent.type
    pendingCount.incrementAndGet()
    // The copy can be big: it runs off the main thread, and JS sees `pending` until it is done.
    executor.execute {
      try {
        copyAll(appContext, uris, sharedText, mimeHint)
      } catch (e: Throwable) {
        Log.w("ShareStore", "share copy failed", e)
      } finally {
        pendingCount.decrementAndGet()
      }
    }
  }

  private fun copyAll(context: Context, uris: List<Uri>, sharedText: String?, mimeHint: String?) {
    val dir = File(context.cacheDir, "shared").apply { mkdirs() }
    // A new share replaces the old one, and old copies are removed.
    dir.listFiles()?.forEach { it.delete() }
    val copied = ArrayList<Item>()
    var big = false
    uris.take(15).forEachIndexed { i, uri ->
      try {
        // Size first (a provider call, but it only reads metadata); a file over the limit is never copied.
        val size = sizeOf(context, uri)
        if (size > MAX_BYTES) {
          big = true
          return@forEachIndexed
        }
        // Open and copy FIRST: WhatsApp's provider gives a short-lived URI ("File expired"), so no other provider call may come before the read.
        val target = File(dir, "${System.currentTimeMillis()}_${i}_shared.tmp")
        if (!copyTo(context, uri, target)) {
          target.delete()
          return@forEachIndexed
        }
        val mime = try { context.contentResolver.getType(uri) } catch (_: Exception) { null } ?: mimeHint ?: ""
        var name = displayName(context, uri) ?: Uri.decode(uri.lastPathSegment ?: "").substringAfterLast('/').ifBlank { "shared_$i" }
        // A zip is told by its first bytes, its name or its type; anything else (photo, voice note) is kept with its real type.
        val zip = isZip(target) || name.endsWith(".zip", ignoreCase = true) || mime.contains("zip", ignoreCase = true)
        val outMime = if (zip) "application/zip" else mime.ifEmpty { "application/octet-stream" }
        if (zip && !name.endsWith(".zip", ignoreCase = true)) name += ".zip"
        val final = File(dir, "${System.currentTimeMillis()}_${i}_${name.replace(Regex("[^A-Za-z0-9._-]"), "_")}")
        val kept = if (target.renameTo(final)) final else target
        if (kept.length() > MAX_BYTES) {
          kept.delete()
          big = true
          return@forEachIndexed
        }
        copied.add(Item(Uri.fromFile(kept).toString(), outMime, name))
      } catch (e: Exception) {
        Log.w("ShareStore", "could not handle shared file $uri", e)
      }
    }
    text = sharedText
    files = copied
    tooBig = big
  }
}
