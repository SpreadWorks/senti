<?php

Configure::write('debug', 2);
Configure::write('App.encoding', 'UTF-8');
Configure::write('App.defaultLocale', 'eng');
Configure::write('App.baseUrl', false);

Configure::write('Dispatcher.filters', array(
    'AssetDispatcher',
    'CacheDispatcher'
));

Configure::write('Session', array(
    'defaults' => 'php'
));

CakePlugin::load('DebugKit');
