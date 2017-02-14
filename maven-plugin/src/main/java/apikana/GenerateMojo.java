package apikana;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.maven.plugin.MojoExecutionException;
import org.apache.maven.plugin.MojoFailureException;
import org.apache.maven.plugins.annotations.LifecyclePhase;
import org.apache.maven.plugins.annotations.Mojo;
import org.apache.maven.plugins.annotations.Parameter;
import org.apache.maven.plugins.annotations.ResolutionScope;

import java.io.File;
import java.io.IOException;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import static org.twdata.maven.mojoexecutor.MojoExecutor.configuration;
import static org.twdata.maven.mojoexecutor.MojoExecutor.element;

/**
 * Generate JSON schemas and a user documentation in HTML from the given swagger and typescript models.
 */
@Mojo(name = "generate", defaultPhase = LifecyclePhase.GENERATE_RESOURCES,
        requiresDependencyResolution = ResolutionScope.COMPILE)
public class GenerateMojo extends AbstractGenerateMojo {
    private static class Version {
        static final String APIKANA = "0.1.3";
    }

    /**
     * The node version to be used.
     */
    @Parameter(defaultValue = "v7.5.0", property = "apikana.node-version")
    private String nodeVersion;

    /**
     * The npm version to be used.
     */
    @Parameter(defaultValue = "4.2.0", property = "apikana.npm-version")
    private String npmVersion;

    /**
     * The url to download npm and node from.
     */
    @Parameter(property = "apikana.download-root")
    private String downloadRoot;

    /**
     * The directory with the models and apis.
     */
    @Parameter(defaultValue = "src", property = "apikana.input")
    private String input;

    /**
     * The directory with the generated artifacts.
     */
    @Parameter(defaultValue = "target/api", property = "apikana.output")
    private String output;

    /**
     * The java package that should be used.
     */
    @Parameter(defaultValue = "apikana.sample", property = "apikana.java-package")
    private String javaPackage;

    /**
     * If the sources should be copied into the output directory.
     */
    @Parameter(defaultValue = "false", property = "apikana.deploy")
    private boolean deploy;

    /**
     * If the globally installed apikana node package should be used.
     */
    @Parameter(defaultValue = "true", property = "apikana.global")
    private boolean global;

    public void execute() throws MojoExecutionException, MojoFailureException {
        try {
            if (!handlePomPackaging()) {
                unpackStyleDependencies(mavenProject.getParent());
                unpackModelDependencies();
                writeProjectProps();
                if (global) {
                    checkNodeInstalled();
                } else {
                    installNode();
                    generatePackageJson(Version.APIKANA);
                    installApikana();
                }
                runApikana();
                mavenProject.addCompileSourceRoot(file(output + "/model/java").getAbsolutePath());
                projectHelper.addResource(mavenProject, file(input).getAbsolutePath(), Arrays.asList("model/**/*.ts"), null);
                projectHelper.addResource(mavenProject, file(output).getAbsolutePath(), Arrays.asList("model/**/*.json"), null);

                projectHelper.attachArtifact(mavenProject, createApiJar(input, output), "api");
            }
        } catch (Exception e) {
            throw new MojoExecutionException("Problem running apikana", e);
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
        final File apikanaPackage = working("node_modules/apikana/package.json");
        if (apikanaPackage.exists()) {
            Map pack = new ObjectMapper().readValue(apikanaPackage, Map.class);
            final String version = (String) pack.get("version");
            if (Version.APIKANA.equals(version)) {
                getLog().info("apikana " + Version.APIKANA + " already installed.");
                return;
            }
        }
//                TODO no path, but just install!!
        executeFrontend("npm", configuration(
                element("arguments", "install c:/work/projects/apikana-nidi/npm/apikana-" + Version.APIKANA + ".tgz")
        ));
//        executeFrontend("npm", configuration(element("arguments", "install")));
    }

    private void runApikana() throws MojoExecutionException {
        final List<String> cmd = Arrays.asList("apikana start",
                relative(working(""), file(input)),
                relative(working(""), file(output)),
                global ? "" : "--",
                "--javaPackage=" + javaPackage,
                "--deploy=" + deploy,
                "--config=properties.json",
                "--dependencyPath=" + relative(working(""), apiDependencies("")));
        final String cmdLine = cmd.stream().collect(Collectors.joining(" "));
        if (global) {
            try {
                final Process apikana = shellCommand(working(""), cmdLine).inheritIO().start();
                if (apikana.waitFor() != 0) {
                    throw new IOException();
                }
            } catch (IOException | InterruptedException e) {
                throw new MojoExecutionException("Could not run apikana", e);
            }
        } else {
            executeFrontend("npm", configuration(element("arguments", "run " + cmdLine)));
        }
    }

}
