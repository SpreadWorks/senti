<?php

App::uses('AppController', 'Controller');

class TagsController extends AppController {

    public $uses = array('Tag');

    public function index() {
        $this->set('tags', $this->paginate('Tag'));
    }

    public function view($id = null) {
        if (!$this->Tag->exists($id)) {
            throw new NotFoundException(__('Invalid tag'));
        }
        $tag = $this->Tag->find('first', array(
            'conditions' => array('Tag.id' => $id),
            'contain' => array('Thread')
        ));
        $this->set('tag', $tag);
    }

    public function add() {
        if ($this->request->is('post')) {
            $this->Tag->create();
            if ($this->Tag->save($this->request->data)) {
                $this->Session->setFlash(__('Tag created.'));
                return $this->redirect(array('action' => 'index'));
            }
            $this->Session->setFlash(__('Could not create tag.'));
        }
    }

    public function edit($id = null) {
        if (!$this->Tag->exists($id)) {
            throw new NotFoundException(__('Invalid tag'));
        }
        if ($this->request->is(array('post', 'put'))) {
            if ($this->Tag->save($this->request->data)) {
                $this->Session->setFlash(__('Tag updated.'));
                return $this->redirect(array('action' => 'index'));
            }
            $this->Session->setFlash(__('Could not update tag.'));
        } else {
            $this->request->data = $this->Tag->read(null, $id);
        }
    }

    public function delete($id = null) {
        $this->request->allowMethod('post', 'delete');
        if (!$this->Tag->exists($id)) {
            throw new NotFoundException(__('Invalid tag'));
        }
        if ($this->Tag->delete($id)) {
            $this->Session->setFlash(__('Tag deleted.'));
        } else {
            $this->Session->setFlash(__('Could not delete tag.'));
        }
        return $this->redirect(array('action' => 'index'));
    }
}
