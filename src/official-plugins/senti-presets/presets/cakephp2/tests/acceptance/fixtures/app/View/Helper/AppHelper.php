<?php
App::uses('AppHelper', 'View/Helper');

class FormatHelper extends AppHelper {
    public function formatDate($date) {
        return date('Y-m-d', strtotime($date));
    }
}
