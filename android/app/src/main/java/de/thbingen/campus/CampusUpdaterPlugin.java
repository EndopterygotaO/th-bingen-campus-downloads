package de.thbingen.campus;

import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.concurrent.Executors;
import java.util.concurrent.ExecutorService;
import org.json.*;

@CapacitorPlugin(name = "CampusUpdater")
public class CampusUpdaterPlugin extends Plugin {
    private static final String REPO = "EndopterygotaO/th-bingen-campus-downloads";
    private static final long MAX_BYTES = 100L * 1024 * 1024;
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private boolean busy = false;

    private PackageInfo installed() throws Exception {
        return getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), PackageManager.GET_SIGNATURES);
    }
    private long code(PackageInfo info) {
        return Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode;
    }
    private HttpURLConnection connect(String address) throws Exception {
        for (int i = 0; i < 6; i++) {
            URI uri = new URI(address);
            String host = uri.getHost();
            if (!"https".equals(uri.getScheme()) || host == null || uri.getUserInfo() != null ||
                !(host.equals("api.github.com") || host.equals("github.com") || host.equals("release-assets.githubusercontent.com") || host.equals("objects.githubusercontent.com"))) {
                throw new IOException("Unzulässige Update-Adresse");
            }
            HttpURLConnection connection = (HttpURLConnection) uri.toURL().openConnection();
            connection.setInstanceFollowRedirects(false);
            connection.setConnectTimeout(30000);
            connection.setReadTimeout(90000);
            connection.setRequestProperty("User-Agent", "Campus-finden-Android");
            connection.setRequestProperty("Accept", "application/vnd.github+json");
            int status = connection.getResponseCode();
            if (status == 301 || status == 302 || status == 303 || status == 307 || status == 308) {
                String location = connection.getHeaderField("Location");
                connection.disconnect();
                if (location == null) throw new IOException("Download-Weiterleitung fehlt");
                address = uri.resolve(location).toString();
            } else if (status == 200) return connection;
            else {
                connection.disconnect();
                throw new IOException(status == 404 ? "Noch keine öffentliche Update-Version verfügbar" : "GitHub antwortet mit HTTP " + status);
            }
        }
        throw new IOException("Zu viele Download-Weiterleitungen");
    }
    private JSONObject latest() throws Exception {
        HttpURLConnection connection = connect("https://api.github.com/repos/" + REPO + "/releases/latest");
        try (InputStream input = connection.getInputStream(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192]; int n;
            while ((n = input.read(buffer)) != -1) {
                if (output.size() + n > 1024 * 1024) throw new IOException("Update-Antwort zu groß");
                output.write(buffer, 0, n);
            }
            JSONObject release = new JSONObject(output.toString(StandardCharsets.UTF_8.name()));
            if (release.optBoolean("draft") || release.optBoolean("prerelease")) throw new IOException("Keine freigegebene Version");
            String tag = release.getString("tag_name");
            if (!tag.matches("v[0-9]+\\.[0-9]+\\.[0-9]+")) throw new IOException("Ungültige Versionsnummer");
            JSONArray assets = release.getJSONArray("assets");
            String expectedName = "Campus-finden-" + tag.substring(1) + "-debug.apk";
            for (int i = 0; i < assets.length(); i++) {
                JSONObject asset = assets.getJSONObject(i);
                if (!expectedName.equals(asset.optString("name")) || !"uploaded".equals(asset.optString("state"))) continue;
                String digest = asset.optString("digest");
                long size = asset.getLong("size");
                String url = asset.getString("browser_download_url");
                String expectedUrl = "https://github.com/" + REPO + "/releases/download/" + tag + "/" + expectedName;
                if (!url.equals(expectedUrl) || !digest.matches("sha256:[a-fA-F0-9]{64}") || size <= 0 || size > MAX_BYTES) throw new IOException("Ungültige APK-Metadaten");
                return new JSONObject().put("version",tag.substring(1)).put("url",url).put("digest",digest.substring(7)).put("size",size);
            }
            throw new IOException("Die aktuelle Version enthält keine passende APK");
        } finally { connection.disconnect(); }
    }
    private boolean newer(String remote, String local) {
        String[] a = remote.split("\\."), b = local.split("\\.");
        for (int i = 0; i < 3; i++) {
            int x = Integer.parseInt(a[i]), y = Integer.parseInt(b[i]);
            if (x != y) return x > y;
        }
        return false;
    }
    private String hash(File file) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (InputStream input = new FileInputStream(file)) {
            byte[] buffer = new byte[32768]; int n;
            while ((n = input.read(buffer)) != -1) digest.update(buffer,0,n);
        }
        StringBuilder value = new StringBuilder();
        for (byte b : digest.digest()) value.append(String.format("%02x", b & 255));
        return value.toString();
    }
    private void verifyPackage(File file, String version) throws Exception {
        PackageInfo apk = getContext().getPackageManager().getPackageArchiveInfo(file.getAbsolutePath(), PackageManager.GET_SIGNATURES);
        PackageInfo current = installed();
        if (apk == null || !current.packageName.equals(apk.packageName) || !version.equals(apk.versionName) || code(apk) <= code(current)) throw new IOException("APK gehört nicht zu einem neueren Campus-App-Update");
        if (apk.signatures == null || current.signatures == null || apk.signatures.length != current.signatures.length) throw new IOException("APK-Signatur fehlt");
        for (Signature signature : current.signatures) {
            if (!Arrays.asList(apk.signatures).contains(signature)) throw new IOException("APK wurde mit einem anderen Schlüssel signiert");
        }
    }
    @PluginMethod public void check(PluginCall call) {
        worker.execute(() -> {
            try {
                JSONObject release = latest(); String current = installed().versionName;
                JSObject result = new JSObject();
                result.put("available",newer(release.getString("version"),current));
                result.put("version",release.getString("version")); result.put("current",current);
                call.resolve(result);
            } catch (Exception error) { call.reject(error.getMessage(),error); }
        });
    }
    @PluginMethod public synchronized void install(PluginCall call) {
        if (busy) { call.reject("Ein Update läuft bereits"); return; }
        busy = true;
        worker.execute(() -> {
            try {
                JSONObject release = latest();
                String version = release.getString("version");
                if (!newer(version,installed().versionName)) throw new IOException("Die aktuelle Version ist bereits installiert");
                File directory = new File(getContext().getCacheDir(),"updates");
                if (!directory.exists() && !directory.mkdirs()) throw new IOException("Update-Ordner konnte nicht erstellt werden");
                File apk = new File(directory,"campus-update.apk");
                String expectedHash = release.getString("digest");
                long expectedSize = release.getLong("size");
                if (!apk.exists() || apk.length() != expectedSize || !hash(apk).equalsIgnoreCase(expectedHash)) {
                    File partial = new File(directory,"campus-update.part");
                    HttpURLConnection connection = connect(release.getString("url"));
                    try (InputStream input = connection.getInputStream(); OutputStream output = new FileOutputStream(partial)) {
                        byte[] buffer = new byte[32768]; int n; long total = 0;
                        while ((n = input.read(buffer)) != -1) {
                            total += n;
                            if (total > expectedSize || total > MAX_BYTES) throw new IOException("APK-Download ist zu groß");
                            output.write(buffer,0,n);
                        }
                    } finally { connection.disconnect(); }
                    if (partial.length() != expectedSize || !hash(partial).equalsIgnoreCase(expectedHash)) { partial.delete(); throw new IOException("APK-Prüfsumme stimmt nicht überein"); }
                    if (apk.exists() && !apk.delete()) throw new IOException("Alte Update-Datei konnte nicht ersetzt werden");
                    if (!partial.renameTo(apk)) throw new IOException("Update konnte nicht gespeichert werden");
                }
                verifyPackage(apk,version);
                getActivity().runOnUiThread(() -> {
                    try {
                        JSObject result = new JSObject();
                        if (Build.VERSION.SDK_INT >= 26 && !getContext().getPackageManager().canRequestPackageInstalls()) {
                            Intent settings = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,Uri.parse("package:"+getContext().getPackageName()));
                            getActivity().startActivity(settings);
                            result.put("needsPermission",true);
                        } else {
                            Uri uri = FileProvider.getUriForFile(getContext(),getContext().getPackageName()+".fileprovider",apk);
                            Intent install = new Intent(Intent.ACTION_VIEW);
                            install.setDataAndType(uri,"application/vnd.android.package-archive");
                            install.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                            getActivity().startActivity(install);
                            result.put("needsPermission",false);
                        }
                        call.resolve(result);
                    } catch (Exception error) { call.reject(error.getMessage(),error); }
                    finally { synchronized (CampusUpdaterPlugin.this) { busy = false; } }
                });
            } catch (Exception error) {
                synchronized (CampusUpdaterPlugin.this) { busy = false; }
                call.reject(error.getMessage(),error);
            }
        });
    }
}
