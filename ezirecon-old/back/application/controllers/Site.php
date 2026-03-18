<?php
defined('BASEPATH') OR exit('No direct script access allowed');

/**
 * Created by PhpStorm.
 * User: root
 * Date: 4/22/15
 * Time: 11:06 AM
 */

class site extends CI_Controller {


    public function index()
    {
//        $this->daata['title'] = "Dashboard";
//        $this->daata['active'] = "Dashboard";
//        $this->daata['caption'] = "Home";
//        $this->data['view'] = "main/index";
//        $this->load->view("template/base",$this->data);
        redirect("home");
    }
    public function home()
    {
        $this->data['title'] = "Dashboard";
        $this->data['active'] = "Dashboard";
        $this->data['caption'] = "Home";
        $this->data['view'] = "main/index";
        $this->load->view("template/base",$this->data);
    }
    public function companies()
    {
        $this->data['title'] = "Companies";
        $this->data['active'] = "Companies";
        $this->data['caption'] = "All Companies";
        $this->data['view'] = "main/companies";
        $this->load->view("template/base",$this->data);
    }
    public function new_company()
    {
        $this->data['title'] = "New Company";
        $this->data['active'] = "Companies";
        $this->data['caption'] = "Add new company";
        $this->data['view'] = "main/new_company";
        $this->load->view("template/base",$this->data);
    }
    public function add_company_admin()
    {
        $this->data['title'] = "New Company";
        $this->data['active'] = "Companies";
        $this->data['caption'] = "Add new company";
        $this->data['view'] = "main/add_company_admin";
        $this->load->view("template/base",$this->data);
    }
   public function edit_company()
    {
        $this->data['title'] = "Edit Company";
        $this->data['active'] = "Companies";
        $this->data['caption'] = "Modify Company Details";
        $this->data['view'] = "main/edit_company";
        $this->load->view("template/base",$this->data);
    }
    public function view_company()
    {
        $this->data['title'] = "View Company";
        $this->data['active'] = "Companies";
        $this->data['caption'] = "View Company Details";
        $this->data['view'] = "main/view_company";
        $this->load->view("template/base",$this->data);
    }

    public function users()
    {
        $this->data['title'] = "All Users";
        $this->data['active'] = "Users";
        $this->data['caption'] = "List of system users";
        $this->data['view'] = "main/users";
        $this->load->view("template/base",$this->data);

    }
    public function new_system_admin()
    {
        $this->data['title'] = "New User";
        $this->data['active'] = "Users";
        $this->data['caption'] = "Add System Administrator";
        $this->data['view'] = "main/new_super_user";
        $this->load->view("template/base",$this->data);
    }

    public function new_user()
    {
        $this->data['title'] = "New User";
        $this->data['active'] = "Users";
        $this->data['caption'] = "Add User";
        $this->data['view'] = "main/new_user";
        $this->load->view("template/base",$this->data);
    }

    public function edit_user()
    {
        $this->data['title'] = "Edit User";
        $this->data['active'] = "Users";
        $this->data['caption'] = "Edit User Details";
        $this->data['view'] = "main/edit_user";
        $this->load->view("template/base",$this->data);
    }

    public function edit_profile()
    {
        $this->data['title'] = "Edit Profile";
        $this->data['active'] = "Users";
        $this->data['caption'] = "Edit User Profile";
        $this->data['view'] = "main/edit_profile";
        $this->load->view("template/base",$this->data);
    }

    public function accounts()
    {
        $this->data['title'] = "All Accounts";
        $this->data['active'] = "Accounts";
        $this->data['caption'] = "List Of All Accounts";
        $this->data['view'] = "main/accounts";
        $this->load->view("template/base",$this->data);
    }
    public function new_account()
    {
        $this->data['title'] = "New Account";
        $this->data['active'] = "Accounts";
        $this->data['caption'] = "Add New Account";
        $this->data['view'] = "main/new_account";
        $this->load->view("template/base",$this->data);
    }

   public function edit_account()
    {
        $this->data['title'] = "Edit Account";
        $this->data['active'] = "Accounts";
        $this->data['caption'] = "Edit Account Details";
        $this->data['view'] = "main/edit_account";
        $this->load->view("template/base",$this->data);
    }
      public function view_account()
    {
        $this->data['title'] = "View Account";
        $this->data['active'] = "Accounts";
        $this->data['caption'] = "View Account Details";
        $this->data['view'] = "main/view_account";
        $this->load->view("template/base",$this->data);

    }
    public function login()
    {
        $this->data['title'] = "Enter your username and password to login";
        $this->data['active'] = "Login";
        $this->data['caption'] = "Login";
        $this->data['view'] = "main/view_account";
        $this->load->view("template/base",$this->data);
    }
    public function lock()
    {
        $this->data['title'] = "Account Locked";
        $this->data['active'] = "Locked";
        $this->data['caption'] = "Enter Password To Unlock";
        $this->data['view'] = "main/lock";
        $this->load->view("template/base",$this->data);
    }
    public function error()
    {
        $this->data['title'] = "Page Not Found";
        $this->data['active'] = "Error";
        $this->data['caption'] = "404 - Page Not Found";
        $this->data['view'] = "main/error";
        $this->load->view("template/base",$this->data);
    }
    public function unlock()
    {
       /**
        * If still locked
        * redirect to lock
        * else
        * redirect to last loaded page
        */
    }

    /**
     * TODO
     */
    public function new_reconciliation()
    {
        $this->load->view("template/header");
        $this->load->view("template/main-nav");
        $this->load->view("template/index");
        $this->load->view("template/footer");
    }
    public function upload_reconciliation()
    {
        $this->load->view("template/header");
        $this->load->view("template/main-nav");
        $this->load->view("template/index");
        $this->load->view("template/footer");
    }
   public function open_reconciliation()
    {
        $this->load->view("template/header");
        $this->load->view("template/main-nav");
        $this->load->view("template/index");
        $this->load->view("template/footer");
    }
    public function generate_report()
    {
        $this->load->view("template/header");
        $this->load->view("template/main-nav");
        $this->load->view("template/index");
        $this->load->view("template/footer");
    }
    public function new_recon()
    {
        $this->load->view("template/header");
        $this->load->view("template/main-nav");
        $this->load->view("template/index");
        $this->load->view("template/footer");
    }
    public function upload_excel()
    {
        $this->load->view("template/header");
        $this->load->view("template/main-nav");
        $this->load->view("template/index");
        $this->load->view("template/footer");
    }
    public function reopen_recon()
    {
        $this->load->view("template/header");
        $this->load->view("template/main-nav");
        $this->load->view("template/index");
        $this->load->view("template/footer");
    }


    public function add_transaction()
    {
        $this->load->view("template/header");
        $this->load->view("template/main-nav");
        $this->load->view("template/index");
        $this->load->view("template/footer");
    }


    /*******
     * Action controller methods
     */

}