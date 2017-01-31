package apikana;

import org.eclipse.jetty.server.Handler;
import org.eclipse.jetty.server.Server;
import org.eclipse.jetty.server.handler.DefaultHandler;
import org.eclipse.jetty.server.handler.HandlerList;
import org.eclipse.jetty.server.handler.ResourceHandler;
import org.eclipse.jetty.server.handler.ShutdownHandler;
import org.eclipse.jetty.util.FutureCallback;
import org.eclipse.jetty.util.UrlEncoded;
import org.eclipse.jetty.util.resource.Resource;

import java.awt.*;
import java.io.*;
import java.net.URI;

public class ApiServer {
    private static final int PORT = 34945;

    public static void main(String[] args) throws Exception {
        try (Writer out = new OutputStreamWriter(new FileOutputStream(new File("log.txt")))) {
            try {
                preloadClasses();

                final Server server = new Server(PORT);
                server.setHandler(createHandlers());
                server.start();
                Desktop.getDesktop().browse(new URI("http://localhost:" + PORT));
                server.join();
            } catch (Throwable e) {
                e.printStackTrace(new PrintWriter(out));
            }
        }
    }

    private static HandlerList createHandlers() {
        final ResourceHandler uiResource = new ResourceHandler();
        uiResource.setBaseResource(Resource.newClassPathResource("/ui")); // / -> /ui
        final ResourceHandler srcResource = new PathResourceHandler("/src"); // /src -> /src
        srcResource.setBaseResource(Resource.newClassPathResource("/src"));
        final ResourceHandler targetResource = new PathResourceHandler("/target/model"); // /src -> /src
        targetResource.setBaseResource(Resource.newClassPathResource("/target/model"));

        final HandlerList handlers = new HandlerList();
        handlers.setHandlers(new Handler[]{
                uiResource, srcResource, targetResource,
                new ShutdownHandler("666", true, true), new DefaultHandler()});
        return handlers;
    }

    private static void preloadClasses() throws ClassNotFoundException {
        //preload classes needed for shutdown, they can be unavailable when jar file has changed while server ran
        UrlEncoded.class.toString();
        FutureCallback.class.toString();
        Class.forName("org.eclipse.jetty.server.handler.ShutdownHandler$1");
        Class.forName("org.eclipse.jetty.io.ManagedSelector$CloseEndPoints");
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
