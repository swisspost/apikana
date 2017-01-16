package apikana;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.maven.execution.MavenSession;
import org.apache.maven.model.Plugin;
import org.apache.maven.plugin.AbstractMojo;
import org.apache.maven.plugin.BuildPluginManager;
import org.apache.maven.plugin.MojoExecutionException;
import org.apache.maven.plugin.MojoFailureException;
import org.apache.maven.plugins.annotations.Component;
import org.apache.maven.plugins.annotations.LifecyclePhase;
import org.apache.maven.plugins.annotations.Mojo;
import org.apache.maven.plugins.annotations.Parameter;
import org.apache.maven.project.MavenProject;
import org.apache.maven.project.MavenProjectHelper;
import org.codehaus.plexus.util.xml.Xpp3Dom;

import java.io.*;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Enumeration;
import java.util.Map;
import java.util.jar.Attributes;
import java.util.jar.JarOutputStream;
import java.util.jar.Manifest;
import java.util.zip.ZipEntry;
import java.util.zip.ZipException;
import java.util.zip.ZipFile;
import java.util.zip.ZipOutputStream;

import static org.twdata.maven.mojoexecutor.MojoExecutor.*;

@Mojo(name = "generate", defaultPhase = LifecyclePhase.GENERATE_RESOURCES)
public class GenerateMojo extends AbstractMojo {

    @Parameter(defaultValue = "${project}", readonly = true)
    private MavenProject mavenProject;

    @Parameter(defaultValue = "${session}", readonly = true)
    private MavenSession mavenSession;

    @Component
    private BuildPluginManager pluginManager;

    @Component
    private MavenProjectHelper projectHelper;

    @Parameter(defaultValue = "7.4.0")
    private String nodeVersion;

    @Parameter(defaultValue = "4.1.1")
    private String npmVersion;

    @Parameter
    private String downloadRoot;

    @Parameter(defaultValue = "src/api")
    private String input;

    @Parameter(defaultValue = "target")
    private String output;

    @Parameter(defaultValue = "apikana.sample")
    private String javaPackage;

    public void execute() throws MojoExecutionException, MojoFailureException {
        try {
            final String projectProps = writeProjectProps();
            installNode();
            generatePackageJson();
            installApikana();
            runApikana(projectProps);
            projectHelper.attachArtifact(mavenProject, createApiJar(apiJarFile()), "api");
        } catch (Exception e) {
            throw new MojoExecutionException("Problem running apikana", e);
        }
    }

    private String writeProjectProps() throws IOException {
        final Map<String, Object> propectProps = new ProjectSerializer().serialize(mavenProject);
        final String filename = "target/properties.json";
        final File file = new File(filename);
        file.getParentFile().mkdirs();
        new ObjectMapper().writeValue(file, propectProps);
        return filename;
    }

    private File apiJarFile() {
        return new File("target/" + mavenProject.getArtifactId() + "-" + mavenProject.getVersion() + "-api.jar");
    }

    private File createApiJar(File out) throws IOException {
        final Manifest manifest = new Manifest();
        final Attributes mainAttributes = manifest.getMainAttributes();
        mainAttributes.put(Attributes.Name.MANIFEST_VERSION, "1.0");
        mainAttributes.put(Attributes.Name.MAIN_CLASS, ApiServer.class.getName());
        try (JarOutputStream zs = new JarOutputStream(new FileOutputStream(out), manifest)) {
            addDirToZip(zs, output + "/model/json-schema-v3", "model/json-schema-v3");
            addDirToZip(zs, output + "/model/json-schema-v4", "model/json-schema-v4");
            addDirToZip(zs, output + "/ui", "ui");
            addClassToZip(zs, ApiServer.class);
            addClassToZip(zs, ApiServer.PathResourceHandler.class);
            addJettyToZip(zs);
            addDirToZip(zs, input, "src");
        }
        return out;
    }

    private void addJettyToZip(JarOutputStream zs) throws IOException {
        addZipsToZip(zs, "org/eclipse/jetty");
        addZipsToZip(zs, "javax/servlet");
    }

    private void addZipsToZip(JarOutputStream zs, String base) throws IOException {
        final Enumeration<URL> jetty = getClass().getClassLoader().getResources(base);
        while (jetty.hasMoreElements()) {
            final URL url = jetty.nextElement();
            final String path = url.getPath();
            final int jarEnd = path.indexOf(".jar!/");
            if (jarEnd > 0) {
                addZipToZip(zs, path.substring(6, jarEnd + 4));
            }
        }
    }

    private void addZipToZip(ZipOutputStream zs, String zip) throws IOException {
        try (final ZipFile file = new ZipFile(new File(zip))) {
            final Enumeration<? extends ZipEntry> entries = file.entries();
            while (entries.hasMoreElements()) {
                final ZipEntry entry = entries.nextElement();
                addResourceToZip(zs, entry.getName(), file.getInputStream(entry));
            }
        }
    }

    private void addClassToZip(ZipOutputStream zs, Class<?> clazz) throws IOException {
        final String name = clazz.getName().replace('.', '/') + ".class";
        addResourceToZip(zs, name, getClass().getResourceAsStream("/" + name));
    }

    private void addResourceToZip(ZipOutputStream zs, String name, InputStream in) throws IOException {
        final ZipEntry zipEntry = new ZipEntry(name);
        try {
            zs.putNextEntry(zipEntry);
            if (in != null) {
                final byte[] buf = new byte[1024];
                int read;
                while ((read = in.read(buf)) > 0) {
                    zs.write(buf, 0, read);
                }
                in.close();
            }
            zs.closeEntry();
        } catch (ZipException e) {
            if (!e.getMessage().startsWith("duplicate entry")) {
                e.printStackTrace();
            }
        }
    }

    private void addDirToZip(ZipOutputStream zs, String source, String target) throws IOException {
        final Path pp = Paths.get(source);
        Files.walk(pp).forEach(path -> {
            final String name = target + "/" + pp.relativize(path).toString().replace('\\', '/');
            try {
                if (Files.isDirectory(path)) {
                    addResourceToZip(zs, name + (name.endsWith("/") ? "" : "/"), null);
                } else {
                    addResourceToZip(zs, name, Files.newInputStream(path));
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        });
    }

    private void generatePackageJson() throws IOException {
        final File file = new File("package.json");
        if (!file.exists()) {
            try (final PrintWriter out = new PrintWriter(new OutputStreamWriter(new FileOutputStream(file), StandardCharsets.UTF_8))) {
                out.println("{");
                out.println("  \"name\": \"" + mavenProject.getArtifactId() + "\",");
                out.println("  \"version\": \"" + mavenProject.getVersion() + "\",");
                out.println("  \"scripts\": {\"apikana\": \"apikana\"},");
                out.println("  \"dependencies\": {\"apikana\": \"^0.1.0\"}");
                out.println("}");
            }
        }
    }

    private void installNode() throws MojoExecutionException {
        executeFrontend("install-node-and-npm", configuration(
                element("downloadRoot", downloadRoot),
                element("nodeVersion", nodeVersion),
                element("npmVersion", npmVersion)
        ));
    }

    private void installApikana() throws MojoExecutionException {
        executeFrontend("npm", configuration(
//                TODO no path, but just install!!
                element("arguments", "install c:/work/projects/apikana-nidi/npm/apikana-0.1.0.tgz")
        ));
//        executeFrontend("npm", configuration(
//                TODO no path, but just install!!
//                element("arguments", "install")
//        ));
    }

    private void runApikana(String config) throws MojoExecutionException {
        executeFrontend("npm", configuration(
                element("arguments", "run apikana " + input + " " + output + " -- --javaPackage=" + javaPackage + " --config=" + config)
        ));
    }

    private void executeFrontend(String goal, Xpp3Dom config) throws MojoExecutionException {
        final String rc = new File(".npmrc").exists() ? "--userconfig .npmrc " : "";
        final Xpp3Dom arguments = config.getChild("arguments");
        if (arguments != null) {
            arguments.setValue(rc + arguments.getValue());
        }
        execute(frontendPlugin(), goal, config);
    }

    private Plugin frontendPlugin() {
        return plugin("com.github.eirslett", "frontend-maven-plugin", "1.3");
    }

    private void execute(Plugin plugin, String goal, Xpp3Dom config) throws MojoExecutionException {
        executeMojo(plugin, goal, config, executionEnvironment(mavenProject, mavenSession, pluginManager));
    }
}
