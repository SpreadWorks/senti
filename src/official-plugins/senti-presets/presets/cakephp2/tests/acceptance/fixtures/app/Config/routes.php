<?php

Router::connect('/', array('controller' => 'threads', 'action' => 'index'));

Router::connect('/login', array('controller' => 'users', 'action' => 'login'));
Router::connect('/logout', array('controller' => 'users', 'action' => 'logout'));
Router::connect('/register', array('controller' => 'users', 'action' => 'register'));

Router::connect('/threads', array('controller' => 'threads', 'action' => 'index'));
Router::connect('/threads/add', array('controller' => 'threads', 'action' => 'add'));
Router::connect('/threads/:id', array('controller' => 'threads', 'action' => 'view'), array('pass' => array('id'), 'id' => '[0-9]+'));
Router::connect('/threads/:id/edit', array('controller' => 'threads', 'action' => 'edit'), array('pass' => array('id'), 'id' => '[0-9]+'));

Router::connect('/threads/:thread_id/posts/add', array('controller' => 'posts', 'action' => 'add'), array('pass' => array('thread_id'), 'thread_id' => '[0-9]+'));

Router::connect('/tags', array('controller' => 'tags', 'action' => 'index'));
Router::connect('/tags/add', array('controller' => 'tags', 'action' => 'add'));
Router::connect('/tags/:id', array('controller' => 'tags', 'action' => 'view'), array('pass' => array('id'), 'id' => '[0-9]+'));

CakePlugin::routes();

require CAKE . 'Config' . DS . 'routes.php';
