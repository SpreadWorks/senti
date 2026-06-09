<?php

App::uses('Model', 'Model');

class AppModel extends Model {

    public $actsAs = array('Containable');

    public $recursive = -1;

    public function beforeSave($options = array()) {
        if (isset($this->data[$this->alias]['created']) && empty($this->data[$this->alias]['created'])) {
            $this->data[$this->alias]['created'] = date('Y-m-d H:i:s');
        }
        $this->data[$this->alias]['modified'] = date('Y-m-d H:i:s');
        return true;
    }
}
