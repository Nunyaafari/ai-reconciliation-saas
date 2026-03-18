<?php if ( ! defined('BASEPATH')) exit('No direct script access allowed');
/* 
 *  ======================================= 
 *  Author     : Isaac Bremang Darko
 *  License    : Protected 
 *  Email      : isaacbremang@gmail.com
 *
 *  ======================================= 
 */
require_once APPPATH."/third_party/PHPExcel.php";

class Excel extends PHPExcel {
    public function __construct() {
        parent::__construct();
    }
}