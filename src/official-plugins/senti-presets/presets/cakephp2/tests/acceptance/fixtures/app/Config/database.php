<?php

class DATABASE_CONFIG {

    public $default = array(
        'datasource' => 'Database/Mysql',
        'persistent' => false,
        'host' => 'localhost',
        'login' => 'root',
        'password' => 'secret',
        'database' => 'bulletin_board',
        'prefix' => '',
        'encoding' => 'utf8'
    );

    public $test = array(
        'datasource' => 'Database/Mysql',
        'persistent' => false,
        'host' => 'localhost',
        'login' => 'root',
        'password' => 'secret',
        'database' => 'bulletin_board_test',
        'prefix' => '',
        'encoding' => 'utf8'
    );
}
