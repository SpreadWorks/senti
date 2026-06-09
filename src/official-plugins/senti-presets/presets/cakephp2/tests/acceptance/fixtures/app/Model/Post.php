<?php

App::uses('AppModel', 'Model');

class Post extends AppModel {

    public $belongsTo = array(
        'User' => array(
            'className' => 'User',
            'foreignKey' => 'user_id'
        ),
        'Thread' => array(
            'className' => 'Thread',
            'foreignKey' => 'thread_id'
        )
    );

    public $validate = array(
        'body' => array(
            'notBlank' => array(
                'rule' => array('notBlank'),
                'message' => 'Post body is required'
            )
        )
    );
}
