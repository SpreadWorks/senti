<?php

App::uses('AppController', 'Controller');

class UsersController extends AppController {

    public $uses = array('User');

    public function beforeFilter() {
        parent::beforeFilter();
        $this->Auth->allow('login', 'register');
    }

    public function login() {
        if ($this->request->is('post')) {
            if ($this->Auth->login()) {
                return $this->redirect($this->Auth->redirectUrl());
            }
            $this->Session->setFlash(__('Invalid username or password.'));
        }
    }

    public function logout() {
        return $this->redirect($this->Auth->logout());
    }

    public function register() {
        if ($this->request->is('post')) {
            $this->User->create();
            $this->request->data['User']['role'] = 'member';
            if ($this->User->save($this->request->data)) {
                $this->Session->setFlash(__('Registration successful.'));
                return $this->redirect(array('action' => 'login'));
            }
            $this->Session->setFlash(__('Could not register.'));
        }
    }
}
