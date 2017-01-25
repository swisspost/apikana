package apikana;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URL;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Enumeration;
import java.util.jar.JarOutputStream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipException;
import java.util.zip.ZipFile;
import java.util.zip.ZipOutputStream;

class IoUtils {
    private IoUtils() {
    }

    public static void copy(InputStream in, OutputStream out) throws IOException {
        try (final InputStream i = in) {
            final byte[] buf = new byte[1024];
            int read;
            while ((read = i.read(buf)) > 0) {
                out.write(buf, 0, read);
            }
        }
    }

    public static void addZipsToZip(JarOutputStream zs, String base) throws IOException {
        final Enumeration<URL> resources = IoUtils.class.getClassLoader().getResources(base);
        while (resources.hasMoreElements()) {
            final URL url = resources.nextElement();
            final String path = url.getPath();
            final int jarEnd = path.indexOf(".jar!/");
            if (jarEnd > 0) {
                addZipToZip(zs, path.substring(6, jarEnd + 4));
            }
        }
    }

    public static void addZipToZip(ZipOutputStream zs, String zip) throws IOException {
        try (final ZipFile file = new ZipFile(new File(zip))) {
            final Enumeration<? extends ZipEntry> entries = file.entries();
            while (entries.hasMoreElements()) {
                final ZipEntry entry = entries.nextElement();
                addResourceToZip(zs, entry.getName(), file.getInputStream(entry));
            }
        }
    }

    public static void addClassToZip(ZipOutputStream zs, Class<?> clazz) throws IOException {
        final String name = clazz.getName().replace('.', '/') + ".class";
        addResourceToZip(zs, name, IoUtils.class.getResourceAsStream("/" + name));
    }


    public static void addDirToZip(ZipOutputStream zs, File source, String target) throws IOException {
        //add directory entries for all parents
        int pos = 0;
        while (true) {
            pos = target.indexOf('/', pos + 1);
            if (pos < 0) {
                break;
            }
            addDirEntryToZip(zs, target.substring(0, pos));
        }
        final Path pp = source.toPath();
        Files.walk(pp).forEach(path -> {
            final String name = target + "/" + pp.relativize(path).toString().replace('\\', '/');
            try {
                if (Files.isDirectory(path)) {
                    addDirEntryToZip(zs, name);
                } else {
                    addResourceToZip(zs, name, Files.newInputStream(path));
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        });
    }

    private static void addDirEntryToZip(ZipOutputStream zs, String dir) throws IOException {
        addResourceToZip(zs, dir + (dir.endsWith("/") ? "" : "/"), null);
    }

    public static void addResourceToZip(ZipOutputStream zs, String name, InputStream in) throws IOException {
        final ZipEntry zipEntry = new ZipEntry(name);
        try {
            zs.putNextEntry(zipEntry);
            if (in != null) {
                copy(in, zs);
            }
            zs.closeEntry();
        } catch (ZipException e) {
            if (!e.getMessage().startsWith("duplicate entry")) {
                e.printStackTrace();
            }
        }
    }

}
