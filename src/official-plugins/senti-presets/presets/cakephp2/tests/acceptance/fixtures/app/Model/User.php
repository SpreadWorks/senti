<?php

App::uses('AppModel', 'Model');
App::uses('BlowfishPasswordHasher', 'Controller/Component/Auth');

class User extends AppModel {

    public $hasMany = array(
        'Thread' => array(
            'className' => 'Thread',
            'foreignKey' => 'user_id',
            'dependent' => true
        ),
        'Post' => array(
            'className' => 'Post',
            'foreignKey' => 'user_id',
            'dependent' => true
        )
    );

    public $validate = array(
        'name' => array(
            'notBlank' => array(
                'rule' => array('notBlank'),
                'message' => 'Name is required'
            )
        ),
        'email' => array(
            'email' => array(
                'rule' => array('email'),
                'message' => 'Please enter a valid email'
            ),
            'unique' => array(
                'rule' => 'isUnique',
                'message' => 'This email is already taken'
            )
        ),
        'password' => array(
            'notBlank' => array(
                'rule' => array('notBlank'),
                'message' => 'Password is required'
            ),
            'minLength' => array(
                'rule' => array('minLength', 8),
                'message' => 'Password must be at least 8 characters'
            )
        ),
        'role' => array(
            'valid' => array(
                'rule' => array('inList', array('admin', 'moderator', 'member')),
                'message' => 'Invalid role'
            )
        )
    );

    public function beforeSave($options = array()) {
        if (isset($this->data[$this->alias]['password'])) {
            $passwordHasher = new BlowfishPasswordHasher();
            $this->data[$this->alias]['password'] = $passwordHasher->hash(
                $this->data[$this->alias]['password']
            );
        }
        return parent::beforeSave($options);
    }
}
