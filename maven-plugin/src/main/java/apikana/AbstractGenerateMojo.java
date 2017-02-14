package apikana;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.maven.artifact.Artifact;
import org.apache.maven.artifact.resolver.ArtifactResolutionRequest;
import org.apache.maven.artifact.resolver.ArtifactResolutionResult;
import org.apache.maven.execution.MavenSession;
import org.apache.maven.model.Plugin;
import org.apache.maven.plugin.AbstractMojo;
import org.apache.maven.plugin.BuildPluginManager;
import org.apache.maven.plugin.MojoExecutionException;
import org.apache.maven.plugins.annotations.Component;
import org.apache.maven.plugins.annotations.Parameter;
import org.apache.maven.project.MavenProject;
import org.apache.maven.project.MavenProjectHelper;
import org.apache.maven.project.ProjectBuilder;
import org.apache.maven.repository.RepositorySystem;
import org.codehaus.plexus.util.xml.Xpp3Dom;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.Enumeration;
import java.util.HashMap;
import java.util.Map;
import java.util.function.Consumer;
import java.util.jar.Attributes;
import java.util.jar.*;

import static apikana.IoUtils.*;
import static org.twdata.maven.mojoexecutor.MojoExecutor.*;

public abstract class AbstractGenerateMojo extends AbstractMojo {
    @Parameter(defaultValue = "${project}", readonly = true)
    protected MavenProject mavenProject;

    @Parameter(defaultValue = "${session}", readonly = true)
    private MavenSession mavenSession;

    @Component
    private BuildPluginManager pluginManager;

    @Component
    protected MavenProjectHelper projectHelper;

    @Component
    private RepositorySystem repositorySystem;

    @Component
    private ProjectBuilder projectBuilder;

    protected boolean handlePomPackaging() throws IOException {
        if ("pom".equals(mavenProject.getPackaging())) {
            getLog().info("Packaging is pom. Skipping execution.");
            mavenProject.getProperties().setProperty("jsonschema2pojo.skip", "true");
            if (file("src/style").exists()) {
                projectHelper.attachArtifact(mavenProject, "jar", "style", createStyleJar());
            }
            return true;
        }
        return false;
    }

    protected void unpackModelDependencies() throws IOException {
        for (final Artifact a : mavenProject.getArtifacts()) {
            final JarFile jar = new JarFile(a.getFile());
            final Enumeration<JarEntry> entries = jar.entries();
            while (entries.hasMoreElements()) {
                final JarEntry entry = entries.nextElement();
                copyModel(jar, entry, "ts", a.getArtifactId());
                copyModel(jar, entry, "json-schema-v3", a.getArtifactId());
                copyModel(jar, entry, "json-schema-v4", a.getArtifactId());
                copyModel(jar, entry, "style", "style");
            }
        }
    }

    protected void unpackStyleDependencies(MavenProject project) throws IOException {
        if (project != null) {
            final ArtifactResolutionRequest req = new ArtifactResolutionRequest();
            req.setArtifact(repositorySystem.createArtifactWithClassifier(project.getGroupId(), project.getArtifactId(), project.getVersion(), "jar", "style"));
            final ArtifactResolutionResult result = repositorySystem.resolve(req);
            if (!result.getArtifacts().isEmpty()) {
                final Artifact artifact = result.getArtifacts().iterator().next();
                final JarFile jar = new JarFile(artifact.getFile());
                final Enumeration<JarEntry> entries = jar.entries();
                while (entries.hasMoreElements()) {
                    final JarEntry entry = entries.nextElement();
                    copyModel(jar, entry, "style", "");
                }
            }
            unpackStyleDependencies(project.getParent());
        }
    }

    private void copyModel(JarFile jar, JarEntry entry, String type, String targetDir) throws IOException {
        final String sourceName = "model/" + type;
        if (!entry.isDirectory() && entry.getName().startsWith(sourceName)) {
            final File modelFile = apiDependencies(type + "/" + targetDir + entry.getName().substring((sourceName).length()));
            modelFile.getParentFile().mkdirs();
            try (final FileOutputStream out = new FileOutputStream(modelFile)) {
                copy(jar.getInputStream(entry), out);
            }
        }
    }

    private void updateJson(File file, Consumer<Map<String, Object>> updater) throws IOException {
        final ObjectMapper mapper = new ObjectMapper();
        final Map<String, Object> json = file.exists() ? mapper.readValue(file, Map.class) : new HashMap<>();
        updater.accept(json);
        mapper.writer().withDefaultPrettyPrinter().writeValue(file, json);
    }

    protected File file(String name) {
        return new File(mavenProject.getBasedir(), name);
    }

    private File target(String name) {
        return new File(mavenProject.getBuild().getDirectory(), name);
    }

    protected File working(String name) {
        return target("npm/" + name);
    }

    protected File apiDependencies(String name) {
        return target("api-dependencies/" + name);
    }

    protected String relative(File base, File f) {
        return base.toPath().relativize(f.toPath()).toString().replace('\\', '/');
    }

    protected void writeProjectProps() throws IOException {
        final Map<String, Object> propectProps = new ProjectSerializer().serialize(mavenProject);
        final File file = working("properties.json");
        file.getParentFile().mkdirs();
        new ObjectMapper().writeValue(file, propectProps);
    }

    protected File createApiJar(String input, String output) throws IOException {
        final Manifest manifest = new Manifest();
        final Attributes mainAttributes = manifest.getMainAttributes();
        mainAttributes.put(Attributes.Name.MANIFEST_VERSION, "1.0");
        mainAttributes.put(Attributes.Name.MAIN_CLASS, ApiServer.class.getName());
        final File file = apiJarFile();
        try (JarOutputStream zs = new JarOutputStream(new FileOutputStream(file), manifest)) {
            addDirToZip(zs, file(output + "/model/json-schema-v3"), "model/json-schema-v3");
            addDirToZip(zs, file(output + "/model/json-schema-v4"), "model/json-schema-v4");
            addDirToZip(zs, file(output + "/ui"), "ui");
            addClassToZip(zs, ApiServer.class);
            addClassToZip(zs, ApiServer.PathResourceHandler.class);
            addJettyToZip(zs);
            addDirToZip(zs, file(input), "src");
            addDirToZip(zs, target("model/ts"), "target/model/ts");
        }
        return file;
    }

    private File apiJarFile() {
        return target(mavenProject.getArtifactId() + "-" + mavenProject.getVersion() + "-api.jar");
    }

    private File createStyleJar() throws IOException {
        final File file = styleJarFile();
        file.getParentFile().mkdirs();
        try (JarOutputStream zs = new JarOutputStream(new FileOutputStream(file))) {
            addDirToZip(zs, file("src/style"), "model/style");
        }
        return file;
    }

    private File styleJarFile() {
        return target(mavenProject.getArtifactId() + "-" + mavenProject.getVersion() + "-style.jar");
    }

    private void addJettyToZip(JarOutputStream zs) throws IOException {
        addZipsToZip(zs, "org/eclipse/jetty");
        addZipsToZip(zs, "javax/servlet");
    }

    protected void generatePackageJson(String version) throws IOException {
        updateJson(working("package.json"), pack -> {
            pack.put("name", mavenProject.getArtifactId());
            pack.put("version", mavenProject.getVersion());
            final Map<String, String> scripts = (Map) pack.merge("scripts", new HashMap<>(), (oldVal, newVal) -> oldVal);
            scripts.put("apikana", "apikana");
            final Map<String, String> devDependencies = (Map) pack.merge("devDependencies", new HashMap<>(), (oldVal, newVal) -> oldVal);
            devDependencies.put("apikana", version);
        });
    }

    protected void checkNodeInstalled() throws MojoExecutionException {
        try {
            Process node = new ProcessBuilder("node", "-v").start();
            if (node.waitFor() != 0) {
                throw new IOException();
            }
        } catch (IOException | InterruptedException e) {
            throw new MojoExecutionException("Node is not installed on this machine.\n" +
                    "- Set <global>false</false> in this plugin's <configuration> or\n" +
                    "- Install node (https://docs.npmjs.com/getting-started/installing-node)");
        }
    }

    protected ProcessBuilder shellCommand(File workDir, String cmd) {
        getLog().info("Workdir: " + workDir);
        getLog().info("Executing: " + cmd);
        final ProcessBuilder pb = System.getProperty("os.name").toLowerCase().contains("windows")
                ? new ProcessBuilder("cmd", "/c", cmd) : new ProcessBuilder("bash", "-c", cmd);
        return pb.directory(workDir);
    }

    protected void executeFrontend(String goal, Xpp3Dom config) throws MojoExecutionException {
        final String rc = new File(".npmrc").exists() ? "--userconfig .npmrc " : "";
        config.addChild(element("workingDirectory", working("").getAbsolutePath()).toDom());
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
