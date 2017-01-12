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

/**
 * Created by niederhauste on 10.01.2017.
 */
public class ApiServer {
    public static void main(String[] args) throws Exception {
        try (Writer out = new OutputStreamWriter(new FileOutputStream(new File("log.txt")))) {
            try {
                final Server server = new Server(8080);
                ResourceHandler resourceHandler = new ResourceHandler();
                resourceHandler.setBaseResource(Resource.newClassPathResource("/ui"));
                HandlerList handlers = new HandlerList();
                handlers.setHandlers(new Handler[]{resourceHandler, new DefaultHandler()});
                server.setHandler(handlers);

                Desktop.getDesktop().browse(new URI("http://localhost:8080"));
                server.start();
                server.join();
            } catch (Throwable e) {
                e.printStackTrace(new PrintWriter(out));
            }
        }
    }
}
