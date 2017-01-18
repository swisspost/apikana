package apikana;

import org.eclipse.jetty.server.Handler;
import org.eclipse.jetty.server.Server;
import org.eclipse.jetty.server.handler.DefaultHandler;
import org.eclipse.jetty.server.handler.HandlerList;
import org.eclipse.jetty.server.handler.ResourceHandler;
import org.eclipse.jetty.util.resource.Resource;

import java.awt.*;
import java.io.*;
import java.net.URI;

public class ApiServer {
    public static void main(String[] args) throws Exception {
        try (Writer out = new OutputStreamWriter(new FileOutputStream(new File("log.txt")))) {
            try {
                final Server server = new Server(8080);
                final ResourceHandler uiResource = new ResourceHandler();
                uiResource.setBaseResource(Resource.newClassPathResource("/ui")); // / -> /ui
                final ResourceHandler srcResource = new PathResourceHandler("/src"); // /src -> /src
                srcResource.setBaseResource(Resource.newClassPathResource("/src"));

                HandlerList handlers = new HandlerList();
                handlers.setHandlers(new Handler[]{uiResource, srcResource, new DefaultHandler()});
                server.setHandler(handlers);

                server.start();
                Desktop.getDesktop().browse(new URI("http://localhost:8080"));
                server.join();
            } catch (Throwable e) {
                e.printStackTrace(new PrintWriter(out));
            }
        }
    }

    static class PathResourceHandler extends ResourceHandler {
        private final String prefix;

        public PathResourceHandler(String prefix) {
            this.prefix = prefix;
        }

        @Override
        public Resource getResource(String path) {
            if (path == null || !path.startsWith(prefix)) {
                return null;
            }
            return super.getResource(path.substring(prefix.length()));
        }
    }
}
