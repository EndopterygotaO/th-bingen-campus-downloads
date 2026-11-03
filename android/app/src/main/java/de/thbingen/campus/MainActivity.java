package de.thbingen.campus;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(CampusUpdaterPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
