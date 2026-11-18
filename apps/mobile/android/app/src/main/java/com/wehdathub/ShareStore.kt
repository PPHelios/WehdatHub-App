package com.wehdathub

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import java.io.File

/** What another app (WhatsApp, Gallery, Files) shared into this one, copied into the app's cache so it stays readable. */
object ShareStore {
  data class Item(val uri: String, val mimeType: String, val name: String)

  @Volatile var text: String? = null
  @Volatile var files: List<Item> = emptyList()

  fun clear() {
    text = null
    files = emptyList()
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

  fun handle(context: Context, intent: Intent?) {
    if (intent == null) return
    val action = intent.action
    if (action != Intent.ACTION_SEND && action != Intent.ACTION_SEND_MULTIPLE) return
    val sharedText = intent.getStringExtra(Intent.EXTRA_TEXT)
    val uris = ArrayList<Uri>()
    if (action == Intent.ACTION_SEND) {
      (intent.getParcelableExtra<Uri>(Intent.EXTRA_STREAM))?.let { uris.add(it) }
    } else {
      intent.getParcelableArrayListExtra<Uri>(Intent.EXTRA_STREAM)?.let { uris.addAll(it) }
    }
    // Some apps put the file only in the clip data, not in EXTRA_STREAM.
    if (uris.isEmpty()) {
      val clip = intent.clipData
      if (clip != null) for (i in 0 until clip.itemCount) clip.getItemAt(i).uri?.let { if (it !in uris) uris.add(it) }
    }
    val dir = File(context.cacheDir, "shared").apply { mkdirs() }
    // A new share replaces the old one, and old copies are removed.
    dir.listFiles()?.forEach { it.delete() }
    val copied = ArrayList<Item>()
    uris.take(15).forEachIndexed { i, uri ->
      try {
        var mime = context.contentResolver.getType(uri) ?: intent.type ?: "application/octet-stream"
        var name = displayName(context, uri) ?: "shared_$i"
        val target = File(dir, "${System.currentTimeMillis()}_${i}_${name.replace(Regex("[^A-Za-z0-9._-]"), "_")}")
        context.contentResolver.openInputStream(uri)?.use { input -> target.outputStream().use { input.copyTo(it) } }
        // The file's first bytes tell a zip even when the sender gave no name or type.
        if (isZip(target)) {
          mime = "application/zip"
          if (!name.endsWith(".zip", ignoreCase = true)) name += ".zip"
        } else if ((mime.isEmpty() || mime == "application/octet-stream") && name.endsWith(".zip", ignoreCase = true)) {
          mime = "application/zip"
        }
        copied.add(Item(Uri.fromFile(target).toString(), mime, name))
      } catch (_: Exception) {
        // A file that cannot be read is skipped; the rest still arrive.
      }
    }
    text = sharedText
    files = copied
    // This intent is handled: a later app resume must not process it again.
    intent.action = null
  }
}
