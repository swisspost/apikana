package apikana;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.maven.artifact.Artifact;
import org.apache.maven.execution.MavenSession;
import org.apache.maven.model.Plugin;
import org.apache.maven.plugin.AbstractMojo;
import org.apache.maven.plugin.BuildPluginManager;
import org.apache.maven.plugin.MojoExecutionException;
import org.apache.maven.plugin.MojoFailureException;
import org.apache.maven.plugins.annotations.*;
import org.apache.maven.project.MavenProject;
import org.apache.maven.project.MavenProjectHelper;
import org.codehaus.plexus.util.xml.Xpp3Dom;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Enumeration;
import java.util.HashMap;
import java.util.Map;
import java.util.jar.Attributes;
import java.util.jar.*;

import static apikana.IoUtils.*;
import static org.twdata.maven.mojoexecutor.MojoExecutor.*;

@Mojo(name = "generate", defaultPhase = LifecyclePhase.GENERATE_RESOURCES,
        requiresDependencyResolution = ResolutionScope.COMPILE)
public class GenerateMojo extends AbstractMojo {
    private static class Version {
        static final String
                APIKANA = "0.1.0",
                TYPESCRIPT = "^2.1.0";
    }

    private static final String TS_DIR = "/model/ts/";

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

    @Parameter(defaultValue = "src")
    private String input;

    @Parameter(defaultValue = "target/api")
    private String output;

    @Parameter(defaultValue = "apikana.sample")
    private String javaPackage;

    @Parameter()
    private boolean deploy;

    public void execute() throws MojoExecutionException, MojoFailureException {
        try {
            unpackModelDependencies();
            configTypescript();
            final String projectProps = writeProjectProps();
            installNode();
            generatePackageJson();
            installApikana();
            runApikana(projectProps);
            projectHelper.attachArtifact(mavenProject, createApiJar(apiJarFile()), "api");
            mavenProject.addCompileSourceRoot(file(output + "/model/java").getAbsolutePath());
            projectHelper.addResource(mavenProject, file(input).getAbsolutePath(), Arrays.asList("model/**/*"), null);
        } catch (Exception e) {
            throw new MojoExecutionException("Problem running apikana", e);
        }
    }

    private void unpackModelDependencies() throws IOException {
        for (final Artifact a : mavenProject.getArtifacts()) {
            final JarFile jar = new JarFile(a.getFile());
            final Enumeration<JarEntry> entries = jar.entries();
            while (entries.hasMoreElements()) {
                final JarEntry entry = entries.nextElement();
                if (!entry.isDirectory() && entry.getName().startsWith(TS_DIR)) {
                    final File modelFile = target(entry.getName());
                    modelFile.getParentFile().mkdirs();
                    try (final FileOutputStream out = new FileOutputStream(modelFile)) {
                        copy(jar.getInputStream(entry), out);
                    }
                }
            }
        }
    }

    private void configTypescript() throws IOException {
        final File configFile = file(input + TS_DIR + "tsconfig.json");
        if (!configFile.exists()) {
            try (final Writer out = new OutputStreamWriter(new FileOutputStream(configFile))) {
                out.write("{}");
            }
        }
        final Map<String, Object> config = new ObjectMapper().readValue(configFile, Map.class);
        Map<String, Object> compilerOptions = (Map) config.get("compilerOptions");
        if (compilerOptions == null) {
            compilerOptions = new HashMap<>();
            config.put("compilerOptions", compilerOptions);
        }
        compilerOptions.put("baseUrl", configFile.getParentFile().toPath().relativize(target(TS_DIR).toPath()).toString().replace('\\', '/'));
        new ObjectMapper().writer().withDefaultPrettyPrinter().writeValue(configFile, config);
    }

    private File file(String name) {
        return new File(mavenProject.getBasedir(), name);
    }

    private File target(String name) {
        return new File(mavenProject.getBuild().getDirectory(), name);
    }

    private String writeProjectProps() throws IOException {
        final Map<String, Object> propectProps = new ProjectSerializer().serialize(mavenProject);
        final File file = target("properties.json");
        file.getParentFile().mkdirs();
        new ObjectMapper().writeValue(file, propectProps);
        return file.getAbsolutePath();
    }

    private File apiJarFile() {
        return target(mavenProject.getArtifactId() + "-" + mavenProject.getVersion() + "-api.jar");
    }

    private File createApiJar(File out) throws IOException {
        final Manifest manifest = new Manifest();
        final Attributes mainAttributes = manifest.getMainAttributes();
        mainAttributes.put(Attributes.Name.MANIFEST_VERSION, "1.0");
        mainAttributes.put(Attributes.Name.MAIN_CLASS, ApiServer.class.getName());
        try (JarOutputStream zs = new JarOutputStream(new FileOutputStream(out), manifest)) {
            addDirToZip(zs, file(output + "/model/json-schema-v3"), "model/json-schema-v3");
            addDirToZip(zs, file(output + "/model/json-schema-v4"), "model/json-schema-v4");
            addDirToZip(zs, file(output + "/ui"), "ui");
            addClassToZip(zs, ApiServer.class);
            addClassToZip(zs, ApiServer.PathResourceHandler.class);
            addJettyToZip(zs);
            addDirToZip(zs, file(input), "src");
        }
        return out;
    }

    private void addJettyToZip(JarOutputStream zs) throws IOException {
        addZipsToZip(zs, "org/eclipse/jetty");
        addZipsToZip(zs, "javax/servlet");
    }

    private void generatePackageJson() throws IOException {
        final File file = file("package.json");
        if (!file.exists()) {
            try (final PrintWriter out = new PrintWriter(new OutputStreamWriter(new FileOutputStream(file), StandardCharsets.UTF_8))) {
                out.println("{");
                out.println("  \"name\": \"" + mavenProject.getArtifactId() + "\",");
                out.println("  \"version\": \"" + mavenProject.getVersion() + "\",");
                out.println("  \"scripts\": {\"apikana\": \"apikana\"},");
                out.println("  \"devDependencies\": {");
                out.println("    \"apikana\": \"" + Version.APIKANA + "\",");
                out.println("    \"typescript\": \"" + Version.TYPESCRIPT + "\",");
                out.println("  }");
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

    private void installApikana() throws IOException, MojoExecutionException {
        final File apikanaPackage = file("node_modules/apikana/package.json");
        if (apikanaPackage.exists()) {
            Map pack = new ObjectMapper().readValue(apikanaPackage, Map.class);
            final String version = (String) pack.get("version");
            if (Version.APIKANA.equals(version)) {
                getLog().info("apikana " + Version.APIKANA + " already installed.");
                return;
            }
        }
        executeFrontend("npm", configuration(
//                TODO no path, but just install!!
                element("arguments", "install c:/work/projects/apikana-nidi/npm/apikana-" + Version.APIKANA + ".tgz")
        ));
//        executeFrontend("npm", configuration(
//                TODO no path, but just install!!
//                element("arguments", "install")
//        ));
    }

    private void runApikana(String config) throws MojoExecutionException {
        executeFrontend("npm", configuration(
                element("arguments", "run apikana " + input + " " + output + " -- --javaPackage=" + javaPackage + " --deploy=" + deploy + " --config=" + config)
        ));
    }

    private void executeFrontend(String goal, Xpp3Dom config) throws MojoExecutionException {
        final String rc = new File(".npmrc").exists() ? "--userconfig .npmrc " : "";
        config.addChild(element("workingDirectory", mavenProject.getBasedir().getAbsolutePath()).toDom());
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
