<?php
App::uses('AppShell', 'Console/Command');

class CleanupShell extends AppShell {
    public function main() {
        $this->out('Running cleanup...');
        $records = $this->Cleanup->find('all', array(
            'conditions' => array('expired' => true)
        ));
        foreach ($records as $record) {
            $this->Cleanup->delete($record['Cleanup']['id']);
        }
        $this->out('Done.');
    }
}
