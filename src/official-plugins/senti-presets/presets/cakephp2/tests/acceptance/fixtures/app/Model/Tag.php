<?php

App::uses('AppModel', 'Model');

class Tag extends AppModel {

    public $hasAndBelongsToMany = array(
        'Thread' => array(
            'className' => 'Thread',
            'joinTable' => 'thread_tag',
            'foreignKey' => 'tag_id',
            'associationForeignKey' => 'thread_id',
            'unique' => 'keepExisting'
        )
    );

    public $validate = array(
        'name' => array(
            'notBlank' => array(
                'rule' => array('notBlank'),
                'message' => 'Tag name is required'
            ),
            'unique' => array(
                'rule' => 'isUnique',
                'message' => 'This tag already exists'
            )
        ),
        'slug' => array(
            'notBlank' => array(
                'rule' => array('notBlank'),
                'message' => 'Slug is required'
            ),
            'unique' => array(
                'rule' => 'isUnique',
                'message' => 'This slug already exists'
            )
        )
    );
}
