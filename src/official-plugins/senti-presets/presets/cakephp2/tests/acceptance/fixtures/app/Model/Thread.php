<?php

App::uses('AppModel', 'Model');

class Thread extends AppModel {

    public $belongsTo = array(
        'User' => array(
            'className' => 'User',
            'foreignKey' => 'user_id'
        )
    );

    public $hasMany = array(
        'Post' => array(
            'className' => 'Post',
            'foreignKey' => 'thread_id',
            'dependent' => true,
            'order' => 'Post.posted_at ASC'
        )
    );

    public $hasAndBelongsToMany = array(
        'Tag' => array(
            'className' => 'Tag',
            'joinTable' => 'thread_tag',
            'foreignKey' => 'thread_id',
            'associationForeignKey' => 'tag_id',
            'unique' => 'keepExisting'
        )
    );

    public $validate = array(
        'title' => array(
            'notBlank' => array(
                'rule' => array('notBlank'),
                'message' => 'Title is required'
            ),
            'maxLength' => array(
                'rule' => array('maxLength', 255),
                'message' => 'Title must be 255 characters or less'
            )
        ),
        'body' => array(
            'notBlank' => array(
                'rule' => array('notBlank'),
                'message' => 'Body is required'
            )
        ),
        'status' => array(
            'valid' => array(
                'rule' => array('inList', array('open', 'closed', 'archived')),
                'message' => 'Invalid status',
                'allowEmpty' => true
            )
        )
    );
}
