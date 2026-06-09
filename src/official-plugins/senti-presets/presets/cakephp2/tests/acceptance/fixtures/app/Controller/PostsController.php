<?php

App::uses('AppController', 'Controller');

class PostsController extends AppController {

    public $uses = array('Post', 'Thread');

    public function add($threadId = null) {
        if (!$this->Thread->exists($threadId)) {
            throw new NotFoundException(__('Invalid thread'));
        }
        if ($this->request->is('post')) {
            $this->Post->create();
            $this->request->data['Post']['user_id'] = $this->Auth->user('id');
            $this->request->data['Post']['thread_id'] = $threadId;
            $this->request->data['Post']['posted_at'] = date('Y-m-d H:i:s');
            if ($this->Post->save($this->request->data)) {
                $this->Session->setFlash(__('Post added.'));
                return $this->redirect(array(
                    'controller' => 'threads',
                    'action' => 'view',
                    $threadId
                ));
            }
            $this->Session->setFlash(__('Could not save post.'));
        }
        $thread = $this->Thread->read(null, $threadId);
        $this->set(compact('thread'));
    }

    public function edit($id = null) {
        if (!$this->Post->exists($id)) {
            throw new NotFoundException(__('Invalid post'));
        }
        if ($this->request->is(array('post', 'put'))) {
            if ($this->Post->save($this->request->data)) {
                $this->Session->setFlash(__('Post updated.'));
                $post = $this->Post->read(null, $id);
                return $this->redirect(array(
                    'controller' => 'threads',
                    'action' => 'view',
                    $post['Post']['thread_id']
                ));
            }
            $this->Session->setFlash(__('Could not update post.'));
        } else {
            $this->request->data = $this->Post->read(null, $id);
        }
    }

    public function delete($id = null) {
        $this->request->allowMethod('post', 'delete');
        if (!$this->Post->exists($id)) {
            throw new NotFoundException(__('Invalid post'));
        }
        $post = $this->Post->read(null, $id);
        $threadId = $post['Post']['thread_id'];
        if ($this->Post->delete($id)) {
            $this->Session->setFlash(__('Post deleted.'));
        } else {
            $this->Session->setFlash(__('Could not delete post.'));
        }
        return $this->redirect(array(
            'controller' => 'threads',
            'action' => 'view',
            $threadId
        ));
    }
}
