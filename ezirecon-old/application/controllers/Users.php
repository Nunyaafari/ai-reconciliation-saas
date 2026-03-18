<?php
/**
 * Created by PhpStorm.
 * User: root
 * Date: 4/25/15
 * Time: 3:21 AM
 */
defined('BASEPATH') OR exit('No direct script access allowed');

class users extends CI_Controller {

   /***
    * Register System Administrator
    */
    public function register_sys_admin()
    {
        $this->form_validation->set_rules("fullname","Fullname","required");
        $this->form_validation->set_rules("username","Username","required");
        $this->form_validation->set_rules("password","Password","required|min_length[8]");
        $this->form_validation->set_rules("confirm_password","Password Confirmation","required|min_length[8]");
        if($this->form_validation->run())
        {
            //form validated

            //check if username exists
            $this->db->where(array("username"=>$this->input->post('username',true)));
            $user_name_check = $this->db->get_where('users')->result_array();
            if(sizeof($user_name_check) == 0)
            {

                echo json_encode(array('status'=>'success'));
                if($this->input->post('password',true) == $this->input->post('confirm_password',true))
                {
                    //username doesnt exist
                    $data = array(
                        "username"=>$this->input->post('username',true),
                        "fullname"=>$this->input->post('fullname',true),
                        "password"=>$this->hasher->create_hash($this->input->post('password',true)),
                        "user_role"=>-1,
                    );
                    $id =  $this->site_model->register_user($data);
                }
                else
                {
                    echo json_encode(array('status'=>'error','error'=>'Sorry password does not match confirmation password'));
                }

            }
            else
            {
                //username exists

                echo json_encode(array('status'=>'error','error'=>'Sorry A User With That Username Exists'));

            }

        }
        else
        {
            //error form not validated
            echo json_encode(array('status'=>'error','error'=> validation_errors()));


        }
    }


    /**
     * Register Company Administrator
     */

    public function register_company_admin()
    {
        $this->form_validation->set_rules("fullname","Fullname","required");
        $this->form_validation->set_rules("username","Username","required");
        $this->form_validation->set_rules("password","Password","required|min_length[8]");
        $this->form_validation->set_rules("confirm_password","Password Confirmation","required|min_length[8]");
        if($this->form_validation->run())
        {
            //form validated

            //check if username exists
            $this->db->where(array("username"=>$this->input->post('username',true)));
            $user_name_check = $this->db->get_where('users')->result_array();
            if(sizeof($user_name_check) == 0)
            {
                if($this->input->post('password',true) == $this->input->post('confirm_password',true) )
                {
                    //username doesnt exist
                    $data = array(
                        "username"=>$this->input->post('username',true),
                        "fullname"=>$this->input->post('fullname',true),
                        "password"=>$this->hasher->create_hash($this->input->post('password',true)),
                        "id_company"=>$this->session->company_created,
                        "user_role"=>0,
                    );
                    $id =  $this->site_model->register_user($data);
                    echo json_encode(array('status'=>'success'));

                }
                else
                {
                    echo json_encode(array('status'=>'error','error'=>'Sorry password does not match confirmation password'));

                }

            }
            else
            {
                //username exists
                echo json_encode(array('status'=>'error','error'=>'Sorry A User With That Username Exists'));

            }

        }
        else
        {
            //error form not validated
            echo json_encode(array('status'=>'error','error'=> validation_errors()));


        }
    }





    /**
     * Register Normal User
     */




    public function register_user()
    {
        $this->form_validation->set_rules("fullname","Fullname","required");
        $this->form_validation->set_rules("username","Username","required");
        $this->form_validation->set_rules("password","Password","required|min_length[8]");
        $this->form_validation->set_rules("confirm_password","Password Confirmation","required|min_length[8]");
        if($this->form_validation->run())
        {
            //form validated

            //check if username exists
            $this->db->where(array("username"=>$this->input->post('username',true)));
            $user_name_check = $this->db->get_where('users')->result_array();
            if(sizeof($user_name_check) == 0)
            {
                if($this->input->post('password',true) == $this->input->post('confirm_password'))
                {
                    //username doesnt exist
                    $data = array(
                        "username"=>$this->input->post('username',true),
                        "fullname"=>$this->input->post('fullname',true),
                        "password"=>$this->hasher->create_hash($this->input->post('password',true)),
                        "id_company"=>$this->input->post('id'),
                        "user_role"=>1,
                    );
                    $id =  $this->site_model->register_user($data);
                    echo json_encode(array('status'=>'success'));

                }
                else
                {
                    echo json_encode(array('status'=>'error','error'=>'Sorry password does not match confirmation password'));

                }

            }
            else
            {
                //username exists
                echo json_encode(array('status'=>'error','error'=>'Sorry A User With That Username Exists'));

            }
        }
        else
        {
            //error form not validated
            echo json_encode(array('status'=>'error','error'=> validation_errors()));


        }
    }







    /**
     * Delete Account
     */



    /**
     * Log System Admin in
     */


    public function login_sys_admin()
    {
        $this->form_validation->set_rules("username","Username","required");
        if($this->form_validation->run())
        {
            //form validated

            //check if username exists
            $where = "username = '".$this->input->post('username',true)." AND (user_role = -1 OR user_role = -5)";
            $this->db->where($where);
            $user_name_check = $this->db->get_where('users')->result_array();
            if(sizeof($user_name_check) > 0 )
            {
                if($this->hasher->validate_password($this->input->post('password',true),$user_name_check['password'])){
                    //check if user is already logged in and check the login time

                    $now = time();
                    $diff = $now - strtotime($user_name_check['last_logged_in']);
                    if($diff > 150000 || $user_name_check['logged_in'] == 0) {
                        $this->session->set_userdata('unique_key', $this->hasher->create_hash(time()));
                        $this->session->set_userdata('user_id', $user_name_check['id']);
                        $this->session->set_userdata('is_locked', 0);
                        $this->site_model->mark_online($user_name_check['id'], $this->session->unique_key);
                        echo json_encode(array('status' => 'success'));
                    }else{
                        echo json_encode(array('status'=>'error','error'=>'Sorry you are already logged in on another device'));

                    }
                    //login
                }else{
                    echo json_encode(array('status'=>'error','error'=>'Sorry username or password not found'));

                }


            }
            else
            {
                //error logging in
                echo json_encode(array('status'=>'error','error'=>'Sorry username or password not found'));

            }

        }
        else
        {
            //error form not validated
            echo json_encode(array('status'=>'error','error'=> validation_errors()));


        }
    }

    /**
     *
     * Log Company Admin in
     */


    public function login_com_admin()
    {
        $this->form_validation->set_rules("username","Username","required");
        if($this->form_validation->run())
        {
            //form validated

            //check if username exists
            $where = "username = '".$this->input->post('username',true)." AND (user_role = 0 OR user_role = -5)";
            $this->db->where($where);
            $user_name_check = $this->db->get_where('users')->result_array();
            if(sizeof($user_name_check) > 0 )
            {
                if($this->hasher->validate_password($this->input->post('password',true),$user_name_check['password'])){
                    //check if user is already logged in and check the login time

                    $now = time();
                    $diff = $now - strtotime($user_name_check['last_logged_in']);
                    if($diff > 150000 || $user_name_check['logged_in'] == 0) {
                        $this->session->set_userdata('unique_key', $this->hasher->create_hash(time()));
                        $this->session->set_userdata('user_id', $user_name_check['id']);
                        $this->session->set_userdata('is_locked', 0);
                        $this->site_model->mark_online($user_name_check['id'], $this->session->unique_key);
                        echo json_encode(array('status' => 'success'));
                    }else{
                        echo json_encode(array('status'=>'error','error'=>'Sorry you are already logged in on another device'));

                    }
                    //login
                }else{
                    echo json_encode(array('status'=>'error','error'=>'Sorry username or password not found'));

                }


            }
            else
            {
                //error logging in
                echo json_encode(array('status'=>'error','error'=>'Sorry username or password not found'));

            }

        }
        else
        {
            //error form not validated
            echo json_encode(array('status'=>'error','error'=> validation_errors()));


        }
    }


    /**
     * Log Normal User
     */


    public function login_user()
    {
        $this->form_validation->set_rules("username","Username","required");
        $this->form_validation->set_rules("password","Password","required");
        if($this->form_validation->run())
        {
            //form validated

            //check if username exists
//            $where = "username = '".$this->input->post('username',true);
            $this->db->where(array("username"=>$this->input->post('username',true)));
            $user_name_check = $this->db->get('users')->result_array();
            if(sizeof($user_name_check) > 0 )
            {
                $user_name_check = $user_name_check[0];
                if($this->hasher->validate_password($this->input->post('password',true),$user_name_check['password'])){
                    //check if user is already logged in and check the login time

                    $now = time();
                    $diff = $now - strtotime($user_name_check['last_logged_in']);
                    //if($diff > 150000 || $user_name_check['logged_in'] == 0) {
                    if($user_name_check['id_company'] == 0)
                    {
                        $this->session->set_userdata('unique_key', $this->hasher->create_hash(time()));
                        $this->session->set_userdata('user_id', $user_name_check['id']);
                        $this->session->set_userdata('is_locked', 0);
                        $this->site_model->mark_online($user_name_check['id'], $this->session->unique_key);
                        if($this->input->post('username') != 'root')
                        {
                            $this->site_model->logger(array('name'=>$this->input->post('username'),'action'=>'Login attempt','response'=>'successful','time'=>time()));
                            $this->site_model->logger(array('name'=>$user_name_check['fullname'],'action'=>'Logged In','response'=>'successful','time'=>time()));

                        }
                        echo json_encode(array('status' => 'success'));
                    }
                    else
                    {
                        $this->db->where('id',$user_name_check['id_company']);
                        $company = $this->db->get('companies')->row();

                        if($company && (time() - $company->expiry) <0)
                        {
                            $this->session->set_userdata('unique_key', $this->hasher->create_hash(time()));
                            $this->session->set_userdata('user_id', $user_name_check['id']);
                            $this->session->set_userdata('is_locked', 0);
                            $this->site_model->mark_online($user_name_check['id'], $this->session->unique_key);
                            if($this->input->post('username') != 'root')
                            {
                                $this->site_model->logger(array('name'=>$this->input->post('username'),'action'=>'Login attempt','response'=>'successful','time'=>time()));
                                $this->site_model->logger(array('name'=>$user_name_check['fullname'],'action'=>'Logged In','response'=>'successful','time'=>time()));

                            }
                            echo json_encode(array('status' => 'success'));
                        }
                        else
                        {
                            echo json_encode(array('status'=>'error','error'=>"Sorry Your Company's Account Has Expired"));

                        }



                    }


                  //  }else{
                      //  echo json_encode(array('status'=>'error','error'=>'Sorry you are already logged in on another device'));

                    //}
                    //login
                }else{
                    if($this->input->post('username') != 'root')
                    {
                        $this->site_model->logger(array('name'=>$this->input->post('username'),'action'=>'Login attempt','response'=>'failure, wrong username or password','time'=>time()));
                    }
                    echo json_encode(array('status'=>'error','error'=>'Sorry username or password not found'));

                }


            }
            else
            {
                //error logging in
                if($this->input->post('username') != 'root')
                {
                    $this->site_model->logger(array('name'=>$this->input->post('username'),'action'=>'Login attempt','response'=>'failure, wrong username or password','time'=>time()));

                }

                echo json_encode(array('status'=>'error','error'=>'Sorry username or password not found'));

            }

        }
        else
        {
            if($this->input->post('username') != 'root')
            {
                $this->site_model->logger(array('name'=>$this->input->post('username'),'action'=>'Login attempt','response'=>'failure, '.strip_tags(validation_errors()),'time'=>time()));
            }

            //error form not validated
            echo json_encode(array('status'=>'error','error'=> validation_errors(),'errors'=>"Please wait"));


        }
    }


    /**
     * Update User Profile
     */




}
