<?php

App::uses('Controller', 'Controller');

class AppController extends Controller {

    public $components = array('Session', 'Auth', 'Acl');

    public $helpers = array('Html', 'Form', 'Session', 'Paginator');

    public function beforeFilter() {
        parent::beforeFilter();
        $this->Auth->allow('index', 'view');
    }
}
