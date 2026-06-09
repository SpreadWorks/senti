<?php

App::uses('AppController', 'Controller');

class ThreadsController extends AppController {

    public $uses = array('Thread', 'Tag');

    public $paginate = array(
        'limit' => 20,
        'order' => array('Thread.created' => 'desc'),
        'contain' => array('User', 'Tag')
    );

    public function index() {
        $this->set('threads', $this->paginate('Thread'));
    }

    public function view($id = null) {
        if (!$this->Thread->exists($id)) {
            throw new NotFoundException(__('Invalid thread'));
        }
        $thread = $this->Thread->find('first', array(
            'conditions' => array('Thread.id' => $id),
            'contain' => array('User', 'Post' => array('User'), 'Tag')
        ));
        $this->set('thread', $thread);
    }

    public function add() {
        if ($this->request->is('post')) {
            $this->Thread->create();
            $this->request->data['Thread']['user_id'] = $this->Auth->user('id');
            if ($this->Thread->save($this->request->data)) {
                $this->Session->setFlash(__('Thread created.'));
                return $this->redirect(array('action' => 'view', $this->Thread->id));
            }
            $this->Session->setFlash(__('Could not create thread.'));
        }
        $tags = $this->Tag->find('list');
        $this->set(compact('tags'));
    }

    public function edit($id = null) {
        if (!$this->Thread->exists($id)) {
            throw new NotFoundException(__('Invalid thread'));
        }
        if ($this->request->is(array('post', 'put'))) {
            if ($this->Thread->save($this->request->data)) {
                $this->Session->setFlash(__('Thread updated.'));
                return $this->redirect(array('action' => 'view', $id));
            }
            $this->Session->setFlash(__('Could not update thread.'));
        } else {
            $this->request->data = $this->Thread->read(null, $id);
        }
        $tags = $this->Tag->find('list');
        $this->set(compact('tags'));
    }

    public function delete($id = null) {
        $this->request->allowMethod('post', 'delete');
        if (!$this->Thread->exists($id)) {
            throw new NotFoundException(__('Invalid thread'));
        }
        if ($this->Thread->delete($id)) {
            $this->Session->setFlash(__('Thread deleted.'));
        } else {
            $this->Session->setFlash(__('Could not delete thread.'));
        }
        return $this->redirect(array('action' => 'index'));
    }
}
