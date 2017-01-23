package apikana.test.test;

import apikana.test.Paths;
import org.junit.Test;

import static apikana.test.Paths2.alarmings;
import static org.junit.Assert.assertEquals;

/**
 * Created by niederhauste on 19.01.2017.
 */
public class PathsTest {
    @Test
    public void simple() {
        assertEquals("/communication/alarming/v1/alarmings", alarmings.path());
        assertEquals("http://base/communication/alarming/v1/alarmings", alarmings.url());
        assertEquals("https://hula/communication/alarming/v1/alarmings", alarmings.url("https://hula"));
        assertEquals("/communication/alarming/v1/alarmings/bla/cancel/request", alarmings.uuid("bla").cancel.request.path());
        assertEquals("http://base/communication/alarming/v1/alarmings/bla/cancel/request", alarmings.uuid("bla").cancel.request.url());
        assertEquals("/communication/alarming/v1/alarmings/bla/status", alarmings.uuid("bla").status.path());
        assertEquals("http://base/communication/alarming/v1/alarmings/bla/status", alarmings.uuid("bla").status.url());

        Paths.alarming.v1.alarmings.path();
        Paths.v1.users.path();
        Paths.v1.users.id(42).path();
    }
}
