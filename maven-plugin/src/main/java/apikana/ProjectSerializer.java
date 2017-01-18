package apikana;

import com.fasterxml.jackson.annotation.JsonFilter;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.ser.impl.SimpleBeanPropertyFilter;
import com.fasterxml.jackson.databind.ser.impl.SimpleFilterProvider;
import org.apache.maven.model.Build;
import org.apache.maven.model.ConfigurationContainer;
import org.apache.maven.model.Model;
import org.apache.maven.project.MavenProject;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

public class ProjectSerializer {
    @JsonFilter("configurationContainer")
    private interface ConfigurationContainerMixIn {
    }

    @JsonFilter("model")
    private interface ModelMixIn {
    }

    @JsonFilter("build")
    private interface BuildMixIn {
    }


    public  Map<String, Object> serialize(MavenProject project) throws IOException {
        final Map<String, Object> props = new HashMap<>();
        for (final String name : project.getProperties().stringPropertyNames()) {
            props.put(name, project.getProperties().getProperty(name));
        }
        final ObjectMapper mapper = new ObjectMapper()
                .addMixIn(ConfigurationContainer.class, ConfigurationContainerMixIn.class)
                .addMixIn(Build.class, BuildMixIn.class)
                .addMixIn(Model.class, ModelMixIn.class);
        final SimpleFilterProvider filter = new SimpleFilterProvider()
                .addFilter("configurationContainer", SimpleBeanPropertyFilter.serializeAllExcept("configuration"))
                .addFilter("build", SimpleBeanPropertyFilter.serializeAllExcept("plugins", "pluginManagement", "pluginsAsMap"))
                .addFilter("model", SimpleBeanPropertyFilter.serializeAllExcept("dependencies", "repositories", "pluginRepositories"));
        final Map<String, Object> modelMap = mapper.readValue(mapper.writer(filter).writeValueAsString(project.getModel()), Map.class);
        props.put("basedir", project.getBasedir());
        props.put("project", modelMap);
        return props;
    }
}