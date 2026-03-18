<?php
/**
 * Created by PhpStorm.
 * User: root
 * Date: 4/25/15
 * Time: 2:21 PM
 */

defined('BASEPATH') OR exit('No direct script access allowed');

class auth extends CI_Controller {

    public function index(){
        $this->login();
    }

    public function login(){
        $this->load->view('main/login');
    }

    public function unlock(){
        if($this->site_model->unlock($this->input->post('password',true)))
        {
            $this->session->set_userdata('is_locked',0);
            echo json_encode(array("status"=>"success"));
        }else{
            echo json_encode(array('status'=>"error",'error'=>"Wrong Password Entered"));
        }
    }



}