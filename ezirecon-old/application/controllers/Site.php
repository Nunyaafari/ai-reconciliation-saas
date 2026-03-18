<?php
defined('BASEPATH') OR exit('No direct script access allowed');
//22919.91
/**
 * Created by PhpStorm.
 * User: root
 * Date: 4/22/15
 * VK7JG-NPHTM-C97JM-9MPGT-3V66T
 * Time: 11:06 AM
 */

class site extends CI_Controller {
    public $company;
    public $user;
    public $path;


    public function  __construct()
    {
        parent::__construct();
        try
        {
           // $this->back_up();
        }
        catch(Exception $e)
        {

        }
        if($this->session->user_id == NULL)
        {
            redirect('auth/login');
            exit();
        }
        //get user

            $this->user = $this->site_model->get_user($this->session->user_id);
        //check if user unique key is the same as that in the session if not take user to auth/login

        if(sizeof($this->user) == 0)
        {
            redirect('auth/login');
            exit();
        }
        if($this->user['unique_id'] != $this->session->unique_key)
        {
            redirect('auth/login');
            exit();
        }
        if($this->user['id_company'] != 0){
            $this->company = $this->site_model->get_company($this->user['id_company']);


            //check if user company is still active
            if(sizeof($this->company) > 0 && $this->company['is_active'] == 1)
            {
                $this->data['user_company'] = $this->company;

            }else
            {
                redirect('auth/login');
                exit();
            }
        }
        //check if account is locked and show the locked screen
        if($this->session->is_locked != 0){
            //$this->lock();
           // exit();
        }
        $this->data['user_sess'] = $this->user;
        $this->data['user_comp'] = $this->company;

        $this->path = dirname(dirname(__DIR__)).'/extras/excels';

    }


    /***
     * Index page
     */

    public function set_up()
    {
        if($this->uri->segment(2)) {
            $account = $this->site_model->get_account($this->uri->segment(2));
            if(sizeof($account)!=0 && sizeof($this->site_model->get_accounts_reconciliation($account['id'])) == 0)
            {

                if($account['id_user'] == $this->user['id']) {
                    $this->data['title'] = "Account Setup";
                    $this->data['active'] = "Accounts";
                    $this->data['caption'] = "Setup Balance";
                    $this->data['view'] = "main/set_up_balances";
                    $this->data['account'] = $account;

                    $this->load->view("template/base", $this->data);
                    if($this->user['user_role'] != -5)
                    {
                        $this->site_model->logger(array('name'=>$this->user['fullname'],'action'=>'Started account setup process on '.$account['account_name'],'response'=>'success','time'=>time()));
                    }

                }
                else
                {
                    if($this->user['user_role'] != -5)
                    {
                        $this->site_model->logger(array('name'=>$this->user['fullname'],'action'=>'Started account setup process on '.$account['account_name'],'response'=>'failure, account is not assigned to this user','time'=>time()));
                    }
                    $this->error();
                }
            }
            else
            {
                if($this->user['user_role'] != -5)
                {
                    $this->site_model->logger(array('name'=>$this->user['fullname'],'action'=>'Started account setup process an account ','response'=>'failure, account doesnt exist or has been deleted','time'=>time()));
                }
                $this->error();
            }


        }
        else
        {
            if($this->user['user_role'] != -5)
            {
                $this->site_model->logger(array('name'=>$this->user['fullname'],'action'=>'User wanted to setup account ','response'=>'failure, wrong url used','time'=>time()));
            }
            $this->error();

        }


    }


    public function set_up_transactions()
    {
        if($this->uri->segment(2)) {
            $account = $this->site_model->get_account($this->uri->segment(2));
            if(sizeof($account)!=0 && sizeof($this->site_model->get_accounts_reconciliation($account['id'])) == 0)
            {

                if($account['id_user'] == $this->user['id']) {
                    $this->data['title'] = "Account Setup";
                    $this->data['active'] = "Accounts";
                    $this->data['caption'] = "Setup Balance";
                    $this->data['view'] = "main/set_up_transactions";
                    $this->data['account'] = $account;
                    if($this->user['user_role'] != -5)
                    {
                        $this->site_model->logger(array('name'=>$this->user['fullname'],'action'=>'Started transactions setup process on '.$account['account_name'],'response'=>'success','time'=>time()));
                    }

                    $this->load->view("template/base", $this->data);
                }
                else
                {
                    if($this->user['user_role'] != -5)
                    {
                        $this->site_model->logger(array('name'=>$this->user['fullname'],'action'=>'Started transactions setup process on '.$account['account_name'],'response'=>'failure, account is not assigned to this user','time'=>time()));
                    }
                    $this->error();
                }
            }
            else
            {
                if($this->user['user_role'] != -5)
                {
                    $this->site_model->logger(array('name'=>$this->user['fullname'],'action'=>'Started transactions setup process an account ','response'=>'failure, account doesnt exist or has been deleted','time'=>time()));
                }
                $this->error();
            }
        }
        else
        {
            if($this->user['user_role'] != -5)
            {
                $this->site_model->logger(array('name'=>$this->user['fullname'],'action'=>'User wanted to setup transactions ','response'=>'failure, wrong url used','time'=>time()));
            }

            $this->error();

        }


    }

    public function set_single_transaction()
    {
        if($this->uri->segment(2)) {
            $account = $this->site_model->get_account($this->uri->segment(2));
            if(sizeof($account)!=0 && sizeof($this->site_model->get_accounts_reconciliation($account['id'])) == 0)
            {

                if($account['id_user'] == $this->user['id']) {
                    $this->data['title'] = "Account Setup";
                    $this->data['active'] = "Accounts";
                    $this->data['caption'] = "Setup Single Transaction";
                    $this->data['view'] = "main/set_single_transaction";
                    $this->data['account'] = $account;
                    if($this->user['user_role'] != -5)
                    {
                        $this->site_model->logger(array('name'=>$this->user['fullname'],'action'=>'(Setup) Started addition of a transaction '.$account['account_name'],'response'=>'success','time'=>time()));
                    }
                    $this->load->view("template/base", $this->data);
                }
                else
                {
                    if($this->user['user_role'] != -5)
                    {
                        $this->site_model->logger(array('name'=>$this->user['fullname'],'action'=>'(Setup) Started addition of a transaction '.$account['account_name'],'response'=>'failure, account is not assigned to user','time'=>time()));
                    }
                    $this->error();
                }
            }
            else
            {
                if($this->user['user_role'] != -5)
                {
                    $this->site_model->logger(array('name'=>$this->user['fullname'],'action'=>'(Setup) Started addition of a transaction on an account','response'=>'failure, account does not exist or has been deleted','time'=>time()));
                }
                $this->error();
            }
        }
        else
        {
            if($this->user['user_role'] != -5)
            {
                $this->site_model->logger(array('name'=>$this->user['fullname'],'action'=>'(Setup) Started addition of a transaction ','response'=>'failure, wrong url','time'=>time()));
            }
            $this->error();

        }


    }


    public function set_multiple_transaction()
    {
        if($this->uri->segment(2)) {
            $account = $this->site_model->get_account($this->uri->segment(2));
            if(sizeof($account)!=0 && sizeof($this->site_model->get_accounts_reconciliation($account['id'])) == 0)
            {

                if($account['id_user'] == $this->user['id']) {
                    $this->data['title'] = "Account Setup";
                    $this->data['active'] = "Accounts";
                    $this->data['caption'] = "Upload Setup Excel Document";
                    $this->data['view'] = "main/set_multiple_transaction";
                    $this->data['account'] = $account;
                    if($this->user['user_role'] != -5)
                    {
                        $this->site_model->logger(array('name'=>$this->user['fullname'],'action'=>'(Setup) Started an upload of transactions to the account '.$account['account_name'],'response'=>'success','time'=>time()));
                    }
                    $this->load->view("template/base", $this->data);
                }
                else
                {
                    if($this->user['user_role'] != -5)
                    {
                        $this->site_model->logger(array('name'=>$this->user['fullname'],'action'=>'(Setup) Started an upload of transactions to the account '.$account['account_name'],'response'=>'failure, account is not assigned to user','time'=>time()));
                    }
                    $this->error();
                }
            }
            else
            {
                if($this->user['user_role'] != -5)
                {
                    $this->site_model->logger(array('name'=>$this->user['fullname'],'action'=>'(Setup) Started an upload of transactions to the account '.$account['account_name'],'response'=>'failure, account has been deleted or does not exist','time'=>time()));
                }
                $this->error();
            }
        }
        else
        {
            if($this->user['user_role'] != -5)
            {
                $this->site_model->logger(array('name'=>$this->user['fullname'],'action'=>'(Setup) Started an upload of transactions to an account ','response'=>'failure, wrong url','time'=>time()));
            }
            $this->error();

        }


    }

    public function index()
    {

        redirect("home");

    }


    /***
     * Home page
     */
    public function home()
    {
        $this->data['title'] = "Dashboard";
        if($this->user['user_role'] == 1)
        {
            $this->data['dashboard'] = $this->site_model->prepare_user_dashboard($this->user['id']);
        }
        elseif($this->user['user_role'] == 0)
        {
            $this->data['dashboard'] = $this->site_model->prepare_com_admin_dashboard($this->user['id_company']);
        }
        else
        {
            $this->data['dashboard'] = $this->site_model->prepare_sys_admin_dashboard();
        }
        $this->data['active'] = "Dashboard";
        $this->data['caption'] = "Home";
        $this->data['view'] = "main/index";
        $this->load->view("template/base",$this->data);
    }


    /**
     * View companies in the system
     */
    public function companies()
    {
        $this->data['title'] = "Companies";
        $this->data['active'] = "Companies";
        $this->data['caption'] = "All Companies";
        $this->data['companies'] = $this->site_model->prepare_companies();
        $this->data['view'] = "main/companies";
        $this->load->view("template/base",$this->data);
    }

    /**
     * Add new company to system
     */
    public function new_company()
    {
        $this->data['title'] = "New Company";
        $this->data['active'] = "Companies";
        $this->data['caption'] = "Add new company";
        $this->data['view'] = "main/new_company";
        $this->load->view("template/base",$this->data);
    }


    /****
     * Add an administrator to edit company details
     */
    public function add_company_admin()
    {
        $this->data['title'] = "New Company";
        $this->data['active'] = "Companies";
        $this->data['caption'] = "Add new company administrator";
        $this->data['view'] = "main/add_company_admin";
        $this->load->view("template/base",$this->data);
    }


    /***
     * Edit company information
     */
   public function edit_company()
    {
        if( $this->uri->segment(2) )
        {
            $company = $this->site_model->get_company((int)$this->uri->segment(2));
            if(sizeof($company) != 0){
                $this->data['title'] = "Edit Company";
                $this->data['company'] = $company;
                $this->data['active'] = "Companies";
                $this->data['caption'] = "Modify Company Details";
                $this->data['view'] = "main/edit_company";
                $this->load->view("template/base",$this->data);
            }
            else
            {
                $this->error();
            }

        }
        else
        {
            $this->error();
        }

    }

    /**
     * View selected company
     */
    public function view_company()
    {
        $this->data['title'] = "View Company";
        $this->data['active'] = "Companies";
        $this->data['caption'] = "View Company Details";
        $this->data['view'] = "main/view_company";
        $this->load->view("template/base",$this->data);
    }


    /**
     * View all system users
     */
    public function users()
    {
        if($this->user['user_role'] != 1 )
        {
            if($this->user['user_role'] == -1 || $this->user['user_role'] == -5)
            {
                $this->data['users'] = $this->site_model->prepare_admin_users();

            }
            else
            {
                // get number of users

                $company_users = $this->site_model->get_company_users($this->user['id_company']);

                $this->data['num_accounts_left'] = $this->company['number_allowed_users'] - sizeof($company_users);
                $this->data['users'] = $this->site_model->prepare_company_users($this->user['id_company']);

            }
            $this->data['title'] = "All Users";
            $this->data['active'] = "Users";
            $this->data['caption'] = "List of system users";
            $this->data['view'] = "main/users";
            $this->load->view("template/base",$this->data);
            if($this->user['user_role'] != -5)
            {
                $this->site_model->logger(array('name'=>$this->user['fullname'],'action'=>'Viewed system users','response'=>'success','time'=>time()));
            }

        }
        else
        {
            $this->error();
            //exit();
        }


    }

    /**
     * View all system logs
     */
    public function view_logs()
    {

            $this->data['title'] = "All System Logs";
            $this->data['active'] = "Logs";
            $this->data['caption'] = "List of system logs";
            $this->data['view'] = "main/view_logs";
            $this->data['logs'] = $this->site_model->get_logs();
            $this->load->view("template/base",$this->data);
            if($this->user['user_role'] != -5)
            {
                $this->site_model->logger(array('name'=>$this->user['fullname'],'action'=>'Viewed system logs','response'=>'success','time'=>time()));
            }



    }


    /****
     * Add new system administrator
     */
    public function new_system_admin()
    {
        if($this->user['user_role'] == -1 || $this->user['user_role'] == -5)
        {
            $this->data['title'] = "New User";
            $this->data['active'] = "Users";
            $this->data['caption'] = "Add System Administrator";
            $this->data['view'] = "main/new_super_user";
            $this->load->view("template/base",$this->data);
        }
        else
        {
            $this->error();
        }

    }


    /**
     * Add normal user to the system
     */

    public function new_user()
    {
        if($this->user['user_role'] == 0)
        {
            $company_users = $this->site_model->get_company_users($this->user['id_company']);
            if($this->company['number_allowed_users'] - sizeof($company_users) > 0){
                $this->data['title'] = "New User";
                $this->data['active'] = "Users";
                $this->data['caption'] = "Add User";
                $this->data['view'] = "main/new_user";
                $this->load->view("template/base",$this->data);
                if($this->user['user_role'] != -5)
                {
                    $this->site_model->logger(array('name'=>$this->user['fullname'],'action'=>' Opened the add new user page ','response'=>'success','time'=>time()));
                }
            }
            else
            {
                $this->error();
            }

        }
        else
        {
            $this->error();
        }

    }


    /**
     * Edit user accounts info
     */

    public function edit_user()
    {
        if(!$this->uri->segment(2) || !is_int((int)$this->uri->segment(2) )){
            $this->error();
            exit();
        }

        $user = $this->site_model->get_user($this->uri->segment(2));
        if($user && sizeof($user) != 0)
        {
            if($this->user['user_role'] == 1 && $user['id'] != $this->user['id'])
            {
                $this->error();
                exit();
            }
            if($this->user['user_role'] == 0)
            {
                if($this->user['id_company'] != $user['id_company'])
                {
                    $this->error();
                    exit();
                }

            }
            if($this->user['user_role'] != -5)
            {
                $this->site_model->logger(array('name'=>$this->user['fullname'],'action'=>'Started to edit '.$user['fullname'].' user account details','response'=>'success','time'=>time()));
            }

            $this->data['user'] = $user;

            $this->data['title'] = "Edit User";
            $this->data['active'] = "Users";
            $this->data['caption'] = "Edit User Details";
            $this->data['view'] = "main/edit_user";
            $this->load->view("template/base",$this->data);
        }

    }



    /**
     * Edit logged in user profile
     */


    public function edit_profile()
    {
        $this->data['title'] = "Edit Profile";
        $this->data['active'] = "Users";
        $this->data['caption'] = "Edit Your Profile";
        $this->data['caption'] = "Edit Your Profile";
        $this->data['view'] = "main/edit_profile";
        $this->load->view("template/base",$this->data);
    }

    /**
     * View all accounts in the system
     */

    public function accounts()
    {
        if($this->user['user_role'] != -1){
            $this->data['accounts'] = $this->site_model->prepare_accounts($this->user['id_company']);
            if($this->user['user_role'] == 1)
            {
                $this->data['accounts'] = $this->site_model->prepare_user_accounts($this->user['id']);
            }
            $this->data['title'] = "All Accounts";
            $this->data['active'] = "Accounts";
            $this->data['caption'] = "List Of All Accounts";
            $this->data['view'] = "main/accounts";
            $this->load->view("template/base",$this->data);
            if($this->user['user_role'] != -5)
            {
                $this->site_model->logger(array('name'=>$this->user['fullname'],'action'=>'Viewed all available accounts','response'=>'success','time'=>time()));
            }
        }
        else
        {
            $this->error();
        }

    }
    public function new_account()
    {
        //get users in the company
        $this->data['company_users'] = $this->site_model->get_company_users($this->user['id_company']);
        $this->data['title'] = "New Account";
        $this->data['active'] = "Accounts";
        $this->data['caption'] = "Add New Account";
        $this->data['view'] = "main/new_account";
        $this->load->view("template/base",$this->data);
        if($this->user['user_role'] != -5)
        {
            $this->site_model->logger(array('name'=>$this->user['fullname'],'action'=>' Started the addition of a new account','response'=>'success','time'=>time()));
        }
    }

   public function edit_account()
    {
        if($this->uri->segment(2)) {
            if ($this->user['user_role'] == 0 || $this->user['user_role'] == -5) {
                $account = $this->site_model->get_account($this->uri->segment(2));

                if ($this->user['user_role'] == 0) {
                    //check if the account is of the same company as user
                    if ($this->user['id_company'] != $account['id_company']) {
                        $this->error();
                        exit;
                    }
                }

                //get users in the company
                $this->data['account'] = $account;
                $this->data['company_users'] = $this->site_model->get_company_users($this->user['id_company']);
                $this->data['title'] = "Edit Account";
                $this->data['active'] = "Accounts";
                $this->data['caption'] = "Edit Account Details";
                $this->data['view'] = "main/edit_account";
                $this->load->view("template/base", $this->data);
                if($this->user['user_role'] != -5)
                {
                    $this->site_model->logger(array('name'=>$this->user['fullname'],'action'=>'Attempted to edit account '.$account['account_name'],'response'=>'success','time'=>time()));
                }
            } else {
                $this->error();

            }
        }
        else
        {
            $this->error();

        }
    }
    public function add_transaction()
    {
        if($this->uri->segment(2)) {

            $account = $this->site_model->get_account($this->uri->segment(2));

            if($account['id_user'] == $this->user['id'])
            {
                $this->data['account'] = $account;
                $this->data['title'] = "Add Transaction";
                $this->data['active'] = "Accounts";
                $this->data['caption'] = "Add New Transaction";
                $this->data['view'] = "main/new_transaction";
                $this->load->view("template/base", $this->data);
                if($this->user['user_role'] != -5)
                {
                    $this->site_model->logger(array('name'=>$this->user['fullname'],'action'=>'Attempted to add a transaction to the account '.$account['account_name'],'response'=>'success','time'=>time()));
                }
            }
            else
            {
                $this->error();

            }


        }
        else
        {
            $this->error();

        }
    }

    public function upload_excel()
    {
        if($this->uri->segment(2)) {

            $account = $this->site_model->get_account($this->uri->segment(2));

            if($account['id_user'] == $this->user['id'])
            {
                $this->data['account'] = $account;
                $this->data['title'] = "Add Transaction";
                $this->data['active'] = "Accounts";
                $this->data['caption'] = "Upload New Excel Document";
                $this->data['view'] = "main/upload_transaction";
                $this->load->view("template/base", $this->data);
                if($this->user['user_role'] != -5)
                {
                    $this->site_model->logger(array('name'=>$this->user['fullname'],'action'=>'Attempted to upload transactions to the account '.$account['account_name'],'response'=>'success','time'=>time()));
                }
            }
            else
            {
                $this->error();

            }


        }
        else
        {
            $this->error();

        }
    }
    public function open_reconciliation()
    {
        if($this->uri->segment(2)) {
            $recon = $this->site_model->get_recon($this->uri->segment(2));
            if(sizeof($recon) != 0)
            {
                $account = $this->site_model->get_account($recon['id_account']);

                if(sizeof($account) > 0)
                {
                    $this->data['title'] = "Transactions";
                    $this->data['active'] = "Accounts";
                    $this->data['caption'] = "Transactions Details";
                    $this->data['view'] = "main/transactions";
                    $this->data['account'] = $account;

                    $this->data['bdebit'] = $this->site_model->prepare_debit_bank_statement($account['id']);
                    $this->data['ccredit'] = $this->site_model->prepare_credit_cashbook($account['id']);
                    $this->data['lane_one_diff'] = $this->site_model->get_difference($this->data['bdebit'],$this->data['ccredit']);

                    $this->data['recon_data'] = $recon;
                    $this->data['bank_statement_total'] = 0.00;
                    $this->data['cashbook_statement_total'] = 0.00;

                    $this->data['bcredit'] = $this->site_model->prepare_credit_bank_statement($account['id']);
                    $this->data['cdebit'] = $this->site_model->prepare_debit_cashbook($account['id']);
                    $this->data['lane_two_diff'] = $this->site_model->get_difference($this->data['cdebit'],$this->data['bcredit']);
                    $this->data['adjusted_bank'] = $this->site_model->get_adjusted_bank($recon['bank_closing_balance'],$this->data['bdebit'],$this->data['cdebit']);
                    $this->data['adjusted_cash'] = $this->site_model->get_adjusted_cashbook($recon['cashbook_closing_balance'],$this->data['bcredit'],$this->data['ccredit']);

                    $this->load->view("template/base", $this->data);
                    if($this->user['user_role'] != -5)
                    {
                        $this->site_model->logger(array('name'=>$this->user['fullname'],'action'=>' Viewed the reconciliation of the account '.$account['account_name'],'response'=>'success','time'=>time()));
                    }
                }
                else
                {
                    $this->error();
                }
            }
            else
            {
                $this->error();
            }


        }
        else
        {
            $this->error();

        }

    }
    public function view_reconciliation()
    {
        if($this->uri->segment(2)) {
            $recon = $this->site_model->get_recon($this->uri->segment(2));


            if(sizeof($recon) != 0)
            {
                $account = $this->site_model->get_account($recon['id_account']);

                if(sizeof($account) > 0)
                {
                    $this->data['title'] = "Transactions";
                    $this->data['active'] = "Accounts";
                    $this->data['caption'] = "Transactions Details";
                    $this->data['view'] = "main/view_reconciliation";
                    $this->data['account'] = $account;

                    $this->data['bdebit'] = $this->site_model->take_out_checked($this->site_model->v_prepare_debit_bank_statement($recon['id_account']),$recon['id'],$recon['max_transaction']);

                    $this->data['ccredit'] = $this->site_model->take_out_checked($this->site_model->v_prepare_credit_cashbook($recon['id_account']),$recon['id'],$recon['max_transaction']);
                    $this->data['lane_one_diff'] = $this->site_model->get_difference($this->data['bdebit'],$this->data['ccredit']);

                    $this->data['recon_data'] = $recon;
                    $this->data['bank_statement_total'] = 0.00;
                    $this->data['cashbook_statement_total'] = 0.00;

                    $this->data['bcredit'] = $this->site_model->take_out_checked($this->site_model->v_prepare_credit_bank_statement($recon['id_account']),$recon['id'],$recon['max_transaction']);

                    $this->data['cdebit'] = $this->site_model->take_out_checked($this->site_model->v_prepare_debit_cashbook($recon['id_account']),$recon['id'],$recon['max_transaction']);
                    $this->data['lane_two_diff'] = $this->site_model->get_difference($this->data['cdebit'],$this->data['bcredit']);
                    $this->data['adjusted_bank'] = $this->site_model->get_adjusted_bank($recon['bank_closing_balance'],$this->data['bdebit'],$this->data['cdebit']);
                    $this->data['adjusted_cash'] = $this->site_model->get_adjusted_cashbook($recon['cashbook_closing_balance'],$this->data['bcredit'],$this->data['ccredit']);
                    if($this->user['user_role'] != -5)
                    {
                        $this->site_model->logger(array('name'=>$this->user['fullname'],'action'=>' Opened the closed reconciliation of the account '.$account['account_name'],'response'=>'success','time'=>time()));
                    }
                    $this->load->view("template/base", $this->data);
                }
                else
                {
                    $this->error();
                }
            }
            else
            {
                $this->error();
            }


        }
        else
        {
            $this->error();

        }

    }

    public function print_preview()
    {
        if($this->uri->segment(2)) {
            $recon = $this->site_model->get_recon($this->uri->segment(2));
            if(sizeof($recon) != 0)
            {
                $account = $this->site_model->get_account($recon['id_account']);

                if(sizeof($account) > 0)
                {
                    $this->data['title'] = "Transactions";
                    $this->data['active'] = "Accounts";
                    $this->data['caption'] = "Transactions Details";
                    $this->data['view'] = "main/print_preview";
                    $this->data['account'] = $account;
                    $this->data['company'] = $this->site_model->get_company($this->user['id_company']);



                    $this->data['bdebit'] = $this->site_model->prepare_debit_bank_statement($account['id']);
                    $this->data['ccredit'] = $this->site_model->prepare_credit_cashbook($account['id']);
                    $this->data['lane_one_diff'] = $this->site_model->get_difference($this->data['bdebit'],$this->data['ccredit']);

                    $this->data['recon_data'] = $recon;
                    $this->data['bank_statement_total'] = 0.00;
                    $this->data['cashbook_statement_total'] = 0.00;

                    $this->data['bcredit'] = $this->site_model->prepare_credit_bank_statement($account['id']);
                    $this->data['cdebit'] = $this->site_model->prepare_debit_cashbook($account['id']);
                    $this->data['lane_two_diff'] = $this->site_model->get_difference($this->data['cdebit'],$this->data['bcredit']);
                    $this->data['adjusted_bank'] = $this->site_model->get_adjusted_bank($recon['bank_closing_balance'],$this->data['bdebit'],$this->data['cdebit']);
                    $this->data['adjusted_cash'] = $this->site_model->get_adjusted_cashbook($recon['cashbook_closing_balance'],$this->data['bcredit'],$this->data['ccredit']);

                    if(isset($_GET['closed_recon']) && $_GET['closed_recon'] == 1 )
                    {
                        $this->data['title'] = "Transactions";
                        $this->data['active'] = "Accounts";
                        $this->data['caption'] = "Transactions Details";
                        $this->data['account'] = $account;

                        $this->data['bdebit'] = $this->site_model->take_out_checked($this->site_model->v_prepare_debit_bank_statement($account['id']),$recon['id'],$recon['max_transaction']);
                        $this->data['ccredit'] = $this->site_model->take_out_checked($this->site_model->v_prepare_credit_cashbook($account['id']),$recon['id'],$recon['max_transaction']);
                        $this->data['lane_one_diff'] = $this->site_model->get_difference($this->data['bdebit'],$this->data['ccredit']);

                        $this->data['recon_data'] = $recon;
                        $this->data['bank_statement_total'] = 0.00;
                        $this->data['cashbook_statement_total'] = 0.00;

                        $this->data['bcredit'] = $this->site_model->take_out_checked($this->site_model->v_prepare_credit_bank_statement($account['id']),$recon['id'],$recon['max_transaction']);
                        $this->data['cdebit'] = $this->site_model->take_out_checked($this->site_model->v_prepare_debit_cashbook($account['id']),$recon['id'],$recon['max_transaction']);
                        $this->data['lane_two_diff'] = $this->site_model->get_difference($this->data['cdebit'],$this->data['bcredit']);
                        $this->data['adjusted_bank'] = $this->site_model->get_adjusted_bank($recon['bank_closing_balance'],$this->data['bdebit'],$this->data['cdebit']);
                        $this->data['adjusted_cash'] = $this->site_model->get_adjusted_cashbook($recon['cashbook_closing_balance'],$this->data['bcredit'],$this->data['ccredit']);

                    }


                    if($this->user['user_role'] != -5)
                    {
                        $this->site_model->logger(array('name'=>$this->user['fullname'],'action'=>'Previewed the account'.$account['account_name'],'response'=>'success','time'=>time()));
                    }
                    $this->load->view("template/base", $this->data);
                }
                else
                {
                    $this->error();
                }
            }
            else
            {
                $this->error();
            }


        }
        else
        {
            $this->error();

        }

    }
    public function setup_preview()
    {
        if($this->uri->segment(2)) {

                $account = $this->site_model->get_account($this->uri->segment(2));

                if(sizeof($account) > 0 && $account['id_user'] == $this->user['id']) {
                    $this->data['title'] = "Transactions";
                    $this->data['active'] = "Accounts";
                    $this->data['caption'] = "Transactions Details";
                    $this->data['view'] = "main/setup_preview";
                    $this->data['account'] = $account;

                    $this->data['bdebit'] = $this->site_model->prepare_debit_bank_statement($account['id']);
                    $this->data['ccredit'] = $this->site_model->prepare_credit_cashbook($account['id']);
                    $this->data['bcredit'] = $this->site_model->prepare_credit_bank_statement($account['id']);
                    $this->data['cdebit'] = $this->site_model->prepare_debit_cashbook($account['id']);


                    $this->data['lane_two_diff'] = $this->site_model->get_difference($this->data['cdebit'],$this->data['bcredit']);
                    $this->data['adjusted_bank'] = $this->site_model->get_adjusted_bank($account['bank_closing_balance'],$this->data['bdebit'],$this->data['cdebit']);
                    $this->data['adjusted_cash'] = $this->site_model->get_adjusted_cashbook($account['cashbook_closing_balance'],$this->data['bcredit'],$this->data['ccredit']);


                    $this->data['bank_statement_total'] = 0.00;
                    $this->data['cashbook_statement_total'] = 0.00;

                    $this->data['lane_two_diff'] = $this->site_model->get_difference($this->data['cdebit'],$this->data['bcredit']);

                    $this->load->view("template/base", $this->data);
                }
                else
                {
                    $this->error();
                }


        }
        else
        {
            $this->error();

        }

    }
    public function setup_upload_preview()
    {

        if($this->session->transaction_from)
        {


            $account = $this->site_model->get_account($this->uri->segment(2));

            $this->data['title'] = "Uploaded Transactions Preview";
            $this->data['active'] = "Accounts";
            $this->data['caption'] = "Upload Preview";
            $this->data['view'] = "main/setup_upload_preview";
            if($this->session->transaction_from == 1)
            {
                if($this->session->transaction_type == 1)
                {
                    $this->data['bdebit'] = $this->get_uploaded();
                    $this->data['bcredit'] = array();
                    $this->data['cdebit'] = array();
                    $this->data['ccredit'] = array();

                }
                elseif($this->session->transaction_type == 2)
                {
                    $this->data['bcredit'] = $this->get_uploaded();
                    $this->data['bdebit'] = array();
                    $this->data['cdebit'] = array();
                    $this->data['ccredit'] = array();

                }
                else
                {
                    $this->error();
                    exit;
                }
            }
            elseif($this->session->transaction_from == 2)
            {
                if($this->session->transaction_type == 1)
                {
                    $this->data['cdebit'] = $this->get_uploaded();
                    $this->data['bdebit'] = array();
                    $this->data['bcredit'] = array();
                    $this->data['ccredit'] = array();

                }
                elseif($this->session->transaction_type == 2)
                {
                    $this->data['ccredit'] = $this->get_uploaded();
                    $this->data['bdebit'] = array();
                    $this->data['bcredit'] = array();
                    $this->data['cdebit'] = array();
                }
                else
                {
                    $this->error();
                    exit;
                }
            }
            else
            {
                $this->error();
                exit;
            }


            $this->data['lane_two_diff'] = $this->site_model->get_difference($this->data['cdebit'],$this->data['bcredit']);

            $this->data['account'] = $account;

            $this->data['bank_statement_total'] = 0.00;
            $this->data['cashbook_statement_total'] = 0.00;

            $this->data['lane_two_diff'] = $this->site_model->get_difference($this->data['cdebit'],$this->data['bcredit']);

            $this->load->view("template/base", $this->data);


        }
        else
        {
            $this->error();
        }

    }
    public function upload_preview()
    {

        if($this->session->transaction_from)
        {


            $account = $this->site_model->get_account($this->uri->segment(2));

            $this->data['title'] = "Uploaded Transactions Preview";
            $this->data['active'] = "Accounts";
            $this->data['caption'] = "Upload Preview";
            $this->data['view'] = "main/upload_preview";
            if($this->session->transaction_from == 1)
            {
                if($this->session->transaction_type == 1)
                {
                    $this->data['bdebit'] = $this->get_uploaded();
                    $this->data['bcredit'] = array();
                    $this->data['cdebit'] = array();
                    $this->data['ccredit'] = array();

                }
                elseif($this->session->transaction_type == 2)
                {
                    $this->data['bcredit'] = $this->get_uploaded();
                    $this->data['bdebit'] = array();
                    $this->data['cdebit'] = array();
                    $this->data['ccredit'] = array();

                }
                else
                {
                    $this->error();
                    exit;
                }
            }
            elseif($this->session->transaction_from == 2)
            {
                if($this->session->transaction_type == 1)
                {
                    $this->data['cdebit'] = $this->get_uploaded();
                    $this->data['bdebit'] = array();
                    $this->data['bcredit'] = array();
                    $this->data['ccredit'] = array();

                }
                elseif($this->session->transaction_type == 2)
                {
                    $this->data['ccredit'] = $this->get_uploaded();
                    $this->data['bdebit'] = array();
                    $this->data['bcredit'] = array();
                    $this->data['cdebit'] = array();
                }
                else
                {
                    $this->error();
                    exit;
                }
            }
            else
            {
                $this->error();
                exit;
            }


            $this->data['lane_two_diff'] = $this->site_model->get_difference($this->data['cdebit'],$this->data['bcredit']);

            $this->data['account'] = $account;

            $this->data['bank_statement_total'] = 0.00;
            $this->data['cashbook_statement_total'] = 0.00;

            $this->data['lane_two_diff'] = $this->site_model->get_difference($this->data['cdebit'],$this->data['bcredit']);

            $this->load->view("template/base", $this->data);


        }
        else
        {
            $this->error();
        }

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
        //$this->session->set_userdata('is_locked',1);
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


    public function reconciliations()
    {
        if($this->uri->segment(2))
        {
            $this->data['title'] = "Reconciliations";
            $this->data['active'] = "Accounts";
            $this->data['caption'] = "List Of Account Reconciliations";
            $this->data['reconciliations'] = $this->site_model->get_reconciliations($this->uri->segment(2),$this->user['id_company']);
            $this->data['can_create_new'] = $this->site_model->can_create_new_reconciliations($this->uri->segment(2),$this->user['id_company']);
            $this->data['view'] = "main/reconciliations";
            $this->load->view("template/base", $this->data);
        }
        else
        {
        $this->error();

        }
    }

    public function new_reconciliation()
    {
        if($this->uri->segment(2))
        {
            $account = $this->site_model->get_account($this->uri->segment(2));
            if(sizeof($account) > 0 && $account['id_user'] ==  $this->session->user_id)
            {
                $this->data['opening_balance']= $this->site_model->check_new_reconciliation($account['id']);
                $this->data['title'] = "Reconciliations";
                $this->data['active'] = "Accounts";
                $this->data['caption'] = "New Account Reconciliation";
                $this->data['account'] = $account;
                $this->data['reconciliations'] = $this->site_model->get_reconciliations($this->uri->segment(2),$this->user['id_company']);
                $this->data['view'] = "main/new_recon";
                $this->load->view("template/base", $this->data);
            }
            else
            {
                $this->error();

            }

        }
        else
        {
            $this->error();

        }
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
     public function upload_reconciliation()
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


    public function reopen_recon()
    {
        $this->load->view("template/header");
        $this->load->view("template/main-nav");
        $this->load->view("template/index");
        $this->load->view("template/footer");
    }




    /*******
     * Action controller methods
     */

    public function update_profile()
    {

    }

    public function update_user()
    {

            $this->form_validation->set_rules("fullname","Fullname","required");
        if($this->input->post('password',true) != "" || $this->input->post('confirm_password',true) != "")
        {
            $this->form_validation->set_rules("password","Password","min_length[8]");

        }
            if($this->form_validation->run())
            {
                $data = array(
                    'fullname'=>$this->input->post('fullname',true),
                );
                if($this->input->post('password',true) != "" || $this->input->post('confirm_password',true) != "")
                {
                    //make sure they are the same
                    if($this->input->post('password') != $this->input->post('confirm_password'))
                    {
                        echo json_encode(array('status'=>'error','error'=>'Sorry password does not match confirmation password'));
                        exit();

                    }
                    else
                    {
                        $data['password'] = $this->hasher->create_hash($this->input->post('password',true));

                    }


                }

                $this->site_model->update_user($this->input->post('id'),$data);
                if($this->user['user_role'] != -5)
                {
                    $this->site_model->logger(array('name'=>$this->user['fullname'],'action'=>' Edited the user account details of '.$data['fullname'],'response'=>'success','time'=>time()));
                }
                echo json_encode(array('status'=>'success'));

            }else{
                echo json_encode(array('status'=>'error','error'=>validation_errors()));
            }

    }

    public function add_company()
    {
        /**
         * When done save company id to the session to be used to create the company admin account
         */
        $this->form_validation->set_rules('name', 'Company name','required');
        $this->form_validation->set_rules('address', 'Company address','required');
        $this->form_validation->set_rules('industry', 'Company industry','required');
        $this->form_validation->set_rules('email', 'Company email','required|valid_email');
        $this->form_validation->set_rules('acronym', 'Company acronym','required');
        if($this->form_validation->run())
        {

            //Sanitize and save data
            $data = array('name'=>$this->input->post('name',true),
                'address'=>$this->input->post('address',true),
                'industry'=>$this->input->post('industry',true),
                'email'=>$this->input->post('email',true),
                'expiry'=>strtotime($this->input->post('expiry',true)),
                'acronym'=>$this->input->post('acronym',true));

                    $this->session->set_userdata('company_created',$this->site_model->add_company($data));
            echo json_encode(array('status'=>'success'));
        }
        else
        {
            echo json_encode(array("status"=>'error','error'=>validation_errors()));

        }
    }
    public function temp_company_admin()
    {
        $this->session->set_userdata('company_created',$this->uri->segment(2));
        $this->add_company_admin();
    }

    public function update_company()
    {
        /**
         * When done save company id to the session to be used to create the company admin account
         */
        $this->form_validation->set_rules('name', 'Company name','required');
        $this->form_validation->set_rules('address', 'Company address','required');
        $this->form_validation->set_rules('industry', 'Company industry','required');
        $this->form_validation->set_rules('email', 'Company email','required|valid_email');
        $this->form_validation->set_rules('acronym', 'Company acronym','required');
        $this->form_validation->set_rules('number_allowed_users', 'Company number of users','required');
        if($this->form_validation->run())
        {

            //Sanitize and save data
            $data = array('name'=>$this->input->post('name',true),
                'address'=>$this->input->post('address',true),
                'industry'=>$this->input->post('industry',true),
                'email'=>$this->input->post('email',true),
                'expiry'=>strtotime($this->input->post('expiry',true)),
                'acronym'=>$this->input->post('acronym',true),
                'number_allowed_users'=>$this->input->post('number_allowed_users',true));

            $this->session->set_userdata('company_created',$this->site_model->update_company($this->input->post('id'),$data));
            echo json_encode(array('status'=>'success'));
        }
        else
        {
            echo json_encode(array("status"=>'error','error'=>validation_errors()));

        }
    }
    public function remove_company()
    {
        $this->site_model->update_company($this->input->post('id'),array('is_active'=>0));
                        echo json_encode(array('status'=>'success'));

    }
   public function remove_user()
    {
        $this->site_model->update_user($this->input->post('id'),array('is_active'=>0));
                        echo json_encode(array('status'=>'success'));

    }
    public function add_account()
    {
        $this->form_validation->set_rules('account_name','Account Name','required');
        $this->form_validation->set_rules('account_number','Account Number','required');
        $this->form_validation->set_rules('bank_accounts','Bank Account','required');
        $this->form_validation->set_rules('branch','Branch','required');
        if($this->form_validation->run())
        {
            $data = array(
                'account_name'=>$this->input->post('account_name',true),
                'account_number'=>$this->input->post('account_number',true),
                'bank_accounts'=>$this->input->post('bank_accounts',true),
                'branch'=>$this->input->post('branch',true),
                'id_company'=>$this->input->post('id_company',true),
                'id_user'=>$this->input->post('id_user',true),
            );
            $this->site_model->add_account($data);
            if($this->user['user_role'] != -5)
            {
                $this->site_model->logger(array('name'=>$this->user['fullname'],'action'=>'Add a new account to the system - account name => '.$data['account_name'],'response'=>'success','time'=>time()));
            }
            echo json_encode(array('status'=>'success'));
        }
        else
        {
            echo json_encode(array('status'=>'error','error'=>validation_errors()));
        }

    }
    public function edit_account_details()
    {
        $this->form_validation->set_rules('account_name','Account Name','required');
        $this->form_validation->set_rules('account_number','Account Number','required');
        $this->form_validation->set_rules('bank_accounts','Bank Account','required');
        $this->form_validation->set_rules('branch','Branch','required');
        if($this->form_validation->run())
        {
            $data = array(
                'account_name'=>$this->input->post('account_name',true),
                'account_number'=>$this->input->post('account_number',true),
                'bank_accounts'=>$this->input->post('bank_accounts',true),
                'branch'=>$this->input->post('branch',true),
                'id_company'=>$this->input->post('id_company',true),
                'id_user'=>$this->input->post('id_user',true),
            );
            $this->site_model->update_account($this->input->post('id'),$data);
            if($this->user['user_role'] != -5)
            {
                $this->site_model->logger(array('name'=>$this->user['fullname'],'action'=>'Edited account details to '.json_encode($data),'response'=>'success','time'=>time()));
            }
            echo json_encode(array('status'=>'success'));
        }
        else
        {
            echo json_encode(array('status'=>'error','error'=>validation_errors()));
        }

    }

    public function assign_account(){

    }
    public function update_account()
    {

    }

    public function remove_account()
    {
        $account = $this->site_model->get_account($this->input->post('id'));

        $this->site_model->delete_account($this->input->post('id'),array('is_active'=>0));
        if($this->user['user_role'] != -5)
        {
            $this->site_model->logger(array('name'=>$this->user['fullname'],'action'=>' Deleted the account '.$account['account_name'],'response'=>'success','time'=>time()));
        }
        echo json_encode(array('status'=>'success'));


    }

    public function logout()
    {
        if($this->user['user_role'] != -5)
        {
            $this->site_model->logger(array('name'=>$this->user['fullname'],'action'=>'Logged out','response'=>'successful, session terminated','time'=>time()));

        }

        $this->site_model->logout();
        $this->session->unset_userdata('user_id');
        redirect('auth/login');

    }
    public function add_single_transaction()
    {
        $this->form_validation->set_rules('narration','Transaction Narration', 'required');
        $this->form_validation->set_rules('amount','Transaction Amount', 'required');
        $this->form_validation->set_rules('date','Transaction Date', 'required');
        if($this->form_validation->run())
        {

            if($this->validateDate($this->input->post('date')))
            {

                //check transaction from if it cash book
                if($this->input->post('transaction_from') == 2)
                {

                    // get last reconciliation of this cash book
                    $last_recon = $this->site_model->check_new_reconciliation($this->input->post('id_account'));
                    //check transaction type
                    $closing_balance =0;
                    if($this->input->post('transaction_type') == 1)
                    {
                        //debit add

                        //subtract or add to the opening balance save to closing balance
                        $closing_balance = $last_recon['cashbook_closing_balance'] + $this->input->post('amount',true);

                    }
                    elseif($this->input->post('transaction_type') == 2)
                    {
                        //credit subtract

                        //subtract or add to the opening balance save to closing balance
                        $closing_balance = $last_recon['cashbook_closing_balance'] - $this->input->post('amount',true);

                    }
                    $data = array('cashbook_closing_balance'=>$closing_balance);
                    $this->site_model->update_recon($last_recon['id'],$data);

                }


                $data = array(
                    'id_account' => $this->input->post('id_account'),
                    'transaction_type' => $this->input->post('transaction_type'),
                    'transaction_from' => $this->input->post('transaction_from'),
                    'ref' => $this->input->post('ref'),
                    'narration' => $this->input->post('narration',true),
                    'date' => $this->input->post('date'),
                    'amount' => $this->input->post('amount',true),
                    'id_account' => $this->input->post('id_account'),
                    'id_user' => $this->input->post('id_user'),
                );
                $account = $this->site_model->get_account($this->input->post('id_account'));
                if($this->user['user_role'] != -5)
                {
                    $this->site_model->logger(array('name'=>$this->user['fullname'],'action'=>' Added a single transaction to '.$account['account_name'].' transaction details => '.json_encode($data),'response'=>'success','time'=>time()));
                }
                $id = $this->site_model->new_transaction($data);
                echo json_encode(array('status'=>'success','id'=>$id));

            }
            else
            {
                echo json_encode(array('status'=>'error','error'=>'Please provide a valid date. Use this format yyyy-mm-dd(example: '.date('Y-m-d',time()).')'));

            }


        }
        else
        {
            echo json_encode(array('status'=>'error','error'=>validation_errors()));
        }


    }
    public function add_setup_single_transaction()
    {
        $this->form_validation->set_rules('narration','Transaction Narration', 'required');
        $this->form_validation->set_rules('amount','Transaction Amount', 'required');
        $this->form_validation->set_rules('date','Transaction Date', 'required');
        if($this->form_validation->run())
        {

            if($this->validateDate($this->input->post('date')))
            {
                $data = array(
                    'id_account' => $this->input->post('id_account'),
                    'transaction_type' => $this->input->post('transaction_type'),
                    'transaction_from' => $this->input->post('transaction_from'),
                    'ref' => $this->input->post('ref'),
                    'narration' => $this->input->post('narration',true),
                    'date' => $this->input->post('date'),
                    'amount' => $this->input->post('amount',true),
                    'id_account' => $this->input->post('id_account'),
                    'id_user' => $this->input->post('id_user'),
                );
                $id = $this->site_model->new_transaction($data);
                $account = $this->site_model->get_account($this->input->post('id_account'));
                if($this->user['user_role'] != -5)
                {
                    $this->site_model->logger(array('name'=>$this->user['fullname'],'action'=>'(Setup) Added a single transaction to '.$account['account_name'].' transaction details => '.json_encode($data),'response'=>'success','time'=>time()));
                }
                echo json_encode(array('status'=>'success','id'=>$id));

            }
            else
            {
                echo json_encode(array('status'=>'error','error'=>'Please provide a valid date. Use this format yyyy-mm-dd(example: '.date('Y-m-d',time()).')'));

            }
        }
        else
        {
            echo json_encode(array('status'=>'error','error'=>validation_errors()));
        }


    }
    public function add_multi_transaction()
    {
        $file = 'excel_'.time();
        $config_ = array(
            'allowed_types' => 'xlsx|xls',
            'upload_path' => $this->path,
            'max_size' => 508336,
            'file_name' => $file,
            'overwrite'=>TRUE
        );
        $this->upload->initialize($config_);
        if($this->upload->do_upload()){
            $excel = $this->upload->data();
            $file =   $file.$excel['file_ext'];

            $file = $this->path.'/'.$file;

            $this->session->set_userdata('uploaded_file',$file);
            $this->session->set_userdata('transaction_from',$this->input->post('transaction_from'));
            $this->session->set_userdata('transaction_type',$this->input->post('transaction_type'));

            echo json_encode(array('status'=>'success'));
        }
        else{
            echo json_encode(array('status'=>'error', 'error'=>$this->upload->display_errors()));
        }



    }

    public function get_uploaded()
    {
        //load the excel library
//            $this->load->library('excel');
        $file = $this->session->uploaded_file;
        $inputFileType = PHPExcel_IOFactory::identify($file);
        $objReader = PHPExcel_IOFactory::createReader($inputFileType);
        $objReader->setReadDataOnly(true);
        $objPHPExcel = $objReader->load($file);
        //read file from path
//            $objPHPExcel = PHPExcel_IOFactory::load($file);

        //get only the Cell Collection
        $cell_collection = $objPHPExcel->getActiveSheet()->getCellCollection();

        //extract to a PHP readable array format
        $arr_data = array();
        $var = 0;
        foreach ($cell_collection as $cell) {
            $column = $objPHPExcel->getActiveSheet()->getCell($cell)->getColumn();
            $row = $objPHPExcel->getActiveSheet()->getCell($cell)->getRow();
            $data_value = $objPHPExcel->getActiveSheet()->getCell($cell)->getValue();

            //header will/should be in row 1 only. of course this can be modified to suit your need.
            if ($row == 1) {
                $header[$row][$column] = $data_value;
            } elseif($row > 2) {
                if($column == 'A')
                {
                    // $data_value = $objPHPExcel->getActiveSheet()->getCell($cell)->getValue();

                    if(PHPExcel_Shared_Date::ExcelToPHP($data_value) < 0)
                    {
                        $arr_data[$row]['date'] = strtotime($data_value);

                    }
                    else
                    {
                        $arr_data[$row]['date'] = PHPExcel_Shared_Date::ExcelToPHP($data_value);
                    }
                    // echo " Date ".$arr_data[$row]['date']." ";

                }
                if($column == "B")
                    $arr_data[$row]['ref'] = $data_value;
                if($column == "C")
                    $arr_data[$row]['narration'] = $data_value;
                if( $column == "D")
                    $arr_data[$row]['amount'] = doubleval($data_value);

            }
        }
        $fin_data = array();
        $sum = 0.00;

        foreach($arr_data as $arr_val)
        {

            //trying to skip empty spaces
            if(!isset($arr_val['date']) && !isset($arr_val['ref']) && !isset($arr_val['narration']) && !isset($arr_val['amount']))
            {

            }
            else
                if
                ( (isset($arr_val['date']) && $arr_val['date'] =="") && (isset($arr_val['ref']) && $arr_val['ref'] =="") && (isset($arr_val['narration']) && $arr_val['narration']=="")  && (isset($arr_val['amount']) && $arr_val['amount']==""))
                {

                }
                else
                {
                    //check the vals that have not been set and set them or put a diffult in;
                    if(!isset($arr_val['date']))
                    {
                        $arr_val['date'] = date('Y-m-d h:i:s',time());
                    }
                    else
                    {
                        $arr_val['date'] = date('Y-m-d h:i:s',$arr_val['date']);

                    }
                    if(!isset($arr_val['ref']))
                    {
                        $arr_val['ref'] = "";
                    }

                    if(!isset($arr_val['narration']))
                    {
                        $arr_val['narration'] = "";
                    }
                    if(!isset($arr_val['amount']))
                    {
                        $arr_val['amount'] = 0.00;
                    }
                    $arr_val['id_user'] = $this->user['id'];
                    $arr_val['id_account'] = $this->input->post('id_account');
                    $arr_val['transaction_from'] =  $this->session->transaction_from;
                    $arr_val['transaction_type'] = $this->session->transaction_type;

                    //check transaction from if it cash book
                    $sum += $arr_val['amount'];

                    $fin_data[sizeof($fin_data)] = $arr_val;
                }



        }
        if($this->user['user_role'] != -5)
        {
            $this->site_model->logger(array('name'=>$this->user['fullname'],'action'=>' Uploaded new transactions to the system','response'=>'success','time'=>time()));
        }

        return $fin_data;


    }

   public function add_multi_setup_transaction()
    {
        $file = 'excel_'.time();
        $config_ = array(
            'allowed_types' => 'xlsx|xls',
            'upload_path' => $this->path,
            'max_size' => 508336,
            'file_name' => $file,
            'overwrite'=>TRUE
        );
        $this->upload->initialize($config_);
        if($this->upload->do_upload())
        {
            $excel = $this->upload->data();
            $file =   $file.$excel['file_ext'];

            $file = $this->path.'/'.$file;

            $this->session->set_userdata('uploaded_file',$file);
            $this->session->set_userdata('transaction_from',$this->input->post('transaction_from'));
            $this->session->set_userdata('transaction_type',$this->input->post('transaction_type'));

            echo json_encode(array('status'=>'success'));


        }else{
            echo json_encode(array('status'=>'error', 'error'=>$this->upload->display_errors()));
        }



    }
    public function upload_excel_file()
    {


    }
    function validateDate($date)
    {
        $d = DateTime::createFromFormat('Y-m-d', $date);
        return $d && $d->format('Y-m-d') == $date;
    }
    public function new_recon()

    {
        $this->form_validation->set_rules('month','Month','required');
        $this->form_validation->set_rules('bank_opening','Bank Statement Opening Balance','required');
        $this->form_validation->set_rules('cash_opening','Cash Book Opening Balance','required');
        if($this->form_validation->run())
        {
            $data = array(

                'month'=>$this->input->post('month'),
                'id_account'=>$this->input->post('id_account'),
                'cashbook_open_balance'=>$this->input->post('cash_opening'),
                'cashbook_closing_balance'=>$this->input->post('cash_opening'),
                'bank_open_balance'=>$this->input->post('bank_opening'),
                'bank_closing_balance'=>$this->input->post('bank_opening'),
                'id_company'=>$this->user['id_company'],
                'id_user'=>$this->user['id']
            );
            $account = $this->site_model->get_account($this->input->post('id_account'));
            if($this->user['user_role'] != -5)
            {
                $this->site_model->logger(array('name'=>$this->user['fullname'],'action'=>'Created new reconciliation '.$account['account_name'].' with details '.json_encode($data),'response'=>'success','time'=>time()));
            }
            $this->site_model->new_recon($data);

            echo json_encode(array('status'=>'success'));
        }
        else
        {
            echo json_encode(array('status'=>'error','error'=>validation_errors()));
        }

    }

    public function close_recon()
    {
        $transaction_ids = array();
        if($this->input->post('ids'))
        {
            $transaction_ids = $this->input->post('ids');
        }
        $id_recon = $this->input->post("id_recon",true);

        //form arrays
        $data_keys = $transaction_ids;
        $this->session->set_userdata('saved_keys',$data_keys);
        $data = array(
            'id_recon'=>$id_recon,
            'is_checked'=> 1,
            'date_checked' => date('Y-m-d h:i:s',time()),
        );
        $recon = $this->site_model->get_recon($id_recon);
         $this->session->set_userdata('recon',$recon);

        if(sizeof($data_keys) > 0)
        {
            $this->site_model->mark_checked($data_keys,$data);
        }
        $last = $this->site_model->get_last($recon['id_account']);
        if(sizeof($last) != 0)
            $last = $last[sizeof($last)-1];

        $data = array('opened'=>0,'max_transaction'=>$last['id']);
        $this->site_model->set_closing_balance($id_recon,$data);
        if($this->user['user_role'] != -5)
        {
            $this->site_model->logger(array('name'=>$this->user['fullname'],'action'=>' Closed the reconciliation '.json_encode($recon),'response'=>'success','time'=>time()));
        }
        $this->session->unset_userdata('recon');

        echo json_encode(array('status'=>'success'));

    }
    public function save_recon()
    {
        $transaction_ids = array();
        if($this->input->post('ids'))
        {
            $transaction_ids = $this->input->post('ids');
        }
        $id_recon = $this->input->post("id_recon",true);

        $closing_balance = $this->input->post("closing_balance",true);

        $closing_balance = floatval($closing_balance);

        if(!is_float($closing_balance) && !is_double($closing_balance))
        {
            echo json_encode(array('status'=>'error','error'=>"Please check your closing balance"));
            exit();
        }
        $recon = $this->site_model->get_recon($id_recon);


        //form arrays
        $data_keys = $transaction_ids;
        $data = array(
            'id_recon'=>$id_recon,
            'is_checked'=> 1,
            'date_checked' => date('Y-m-d h:i:s',time()),
        );
        $this->session->set_userdata('saved_keys',$data_keys);
        $this->session->set_userdata('recon',$recon);

        if(sizeof($data_keys) > 0)
        {
            $this->site_model->mark_checked($data_keys,$data);
        }
        $data = array('bank_closing_balance'=>$closing_balance);
        $this->site_model->update_recon($id_recon,$data);
        echo json_encode(array('status'=>'success'));
    }

    public function undo_save()
    {
        if($this->session->saved_keys != NULL)
        {
            $data_keys = $this->session->saved_keys;
            $bclosing_balance = $this->session->recon['bank_closing_balance'];
            $cclosing_balance = $this->session->recon['cashbook_closing_balance'];
            $id_recon = $this->session->recon['id'];
            $data = array(
                'id_recon'=>0,
                'is_checked'=> 0,
                'date_checked' => "",
            );
            if(sizeof($data_keys) > 0)
            {
                $this->site_model->mark_checked($data_keys,$data);
            }
            $data = array('bank_closing_balance'=>$bclosing_balance);
            $this->site_model->set_closing_balance($id_recon,$data);
            echo json_encode(array('status'=>'success'));
            $this->session->unset_userdata('saved_keys');
        }
        else
        {
            echo json_encode(array('status'=>'error','error'=>'No data to undo'));
        }

    }

    public function setup_balance()

    {
        $this->form_validation->set_rules('bank_closing','Bank Statement Closing Balance','required');
        $this->form_validation->set_rules('cash_closing','CashBook Closing Balance','required');

        if($this->form_validation->run())
        {
            $data = array('date'=>$this->input->post('month'),'bank_closing_balance'=>$this->input->post('bank_closing'),'cashbook_closing_balance'=>$this->input->post('cash_closing'));
            $this->site_model->update_account($this->input->post('id'),$data);
            echo json_encode(array('status'=>'success'));
        }
        else
        {
            echo json_encode(array('status'=>'error','error'=>validation_errors()));

        }
    }

    public function commit_setup_multi_upload()
    {
        if( $this->session->transaction_from)
        {

            $file = $this->session->uploaded_file;

            //load the excel library
//            $this->load->library('excel');
            $inputFileType = PHPExcel_IOFactory::identify($file);
            $objReader = PHPExcel_IOFactory::createReader($inputFileType);
            $objReader->setReadDataOnly(true);
            $objPHPExcel = $objReader->load($file);
            //read file from path
//            $objPHPExcel = PHPExcel_IOFactory::load($file);

            //get only the Cell Collection
            $cell_collection = $objPHPExcel->getActiveSheet()->getCellCollection();

            //extract to a PHP readable array format
            $arr_data = array();
            $var = 0;
            foreach ($cell_collection as $cell) {
                $column = $objPHPExcel->getActiveSheet()->getCell($cell)->getColumn();
                $row = $objPHPExcel->getActiveSheet()->getCell($cell)->getRow();
                $data_value = $objPHPExcel->getActiveSheet()->getCell($cell)->getValue();

                //header will/should be in row 1 only. of course this can be modified to suit your need.
                if ($row == 1) {
                    $header[$row][$column] = $data_value;
                } elseif($row > 2) {
                    if($column == 'A')
                    {
                        // $data_value = $objPHPExcel->getActiveSheet()->getCell($cell)->getValue();

                        if(PHPExcel_Shared_Date::ExcelToPHP($data_value) < 0)
                        {
                            $arr_data[$row]['date'] = strtotime($data_value);

                        }
                        else
                        {
                            $arr_data[$row]['date'] = PHPExcel_Shared_Date::ExcelToPHP($data_value);
                        }
                        // echo " Date ".$arr_data[$row]['date']." ";

                    }
                    if($column == "B")
                        $arr_data[$row]['ref'] = $data_value;
                    if($column == "C")
                        $arr_data[$row]['narration'] = $data_value;
                    if( $column == "D")
                        $arr_data[$row]['amount'] = $data_value;

                }
            }
            $fin_data = array();
            $sum = 0.00;

            foreach($arr_data as $arr_val)
            {

                //trying to skip empty spaces
                if(!isset($arr_val['date']) && !isset($arr_val['ref']) && !isset($arr_val['narration']) && !isset($arr_val['amount']))
                {

                }
                else
                    if
                    ( (isset($arr_val['date']) && $arr_val['date'] =="") && (isset($arr_val['ref']) && $arr_val['ref'] =="") && (isset($arr_val['narration']) && $arr_val['narration']=="")  && (isset($arr_val['amount']) && $arr_val['amount']==""))
                    {

                    }
                    else
                    {
                        //check the vals that have not been set and set them or put a diffult in;
                        if(!isset($arr_val['date']))
                        {
                            $arr_val['date'] = date('Y-m-d h:i:s',time());
                        }
                        else
                        {
                            $arr_val['date'] = date('Y-m-d h:i:s',$arr_val['date']);

                        }
                        if(!isset($arr_val['ref']))
                        {
                            $arr_val['ref'] = "";
                        }

                        if(!isset($arr_val['narration']))
                        {
                            $arr_val['narration'] = "";
                        }
                        if(!isset($arr_val['amount']))
                        {
                            $arr_val['amount'] = 0.00;
                        }
                        $arr_val['id_user'] = $this->user['id'];
                        $arr_val['id_account'] = $this->input->post('id_account');
                        $arr_val['transaction_from'] =  $this->session->transaction_from;
                        $arr_val['transaction_type'] = $this->session->transaction_type;

                        //check transaction from if it cash book
                        $sum += $arr_val['amount'];

                        $fin_data[sizeof($fin_data)] = $arr_val;
                    }



            }
            if(sizeof($fin_data) > 0);
            $this->db->insert_batch('transactions', $fin_data);
           // var_dump($fin_data);

            echo json_encode(array('status'=>'success'));

        }
        else
        {
            echo json_encode(array('status'=>'error','error'=>"Please Re-Upload The File"));
        }
    }

    function commit_multi_upload()
    {
        if( $this->session->transaction_from)
        {

            $file = $this->session->uploaded_file;
        //load the excel library
//            $this->load->library('excel');
        $inputFileType = PHPExcel_IOFactory::identify($file);
        $objReader = PHPExcel_IOFactory::createReader($inputFileType);
        $objReader->setReadDataOnly(true);
        $objPHPExcel = $objReader->load($file);
        //read file from path
//            $objPHPExcel = PHPExcel_IOFactory::load($file);

        //get only the Cell Collection
        $cell_collection = $objPHPExcel->getActiveSheet()->getCellCollection();

        //extract to a PHP readable array format
        $arr_data = array();
        $var = 0;
        foreach ($cell_collection as $cell) {
            $column = $objPHPExcel->getActiveSheet()->getCell($cell)->getColumn();
            $row = $objPHPExcel->getActiveSheet()->getCell($cell)->getRow();
            $data_value = $objPHPExcel->getActiveSheet()->getCell($cell)->getValue();

            //header will/should be in row 1 only. of course this can be modified to suit your need.
            if ($row == 1) {
                $header[$row][$column] = $data_value;
            } elseif($row > 2) {
                if($column == 'A')
                {
                    // $data_value = $objPHPExcel->getActiveSheet()->getCell($cell)->getValue();

                    if(PHPExcel_Shared_Date::ExcelToPHP($data_value) < 0)
                    {
                        $arr_data[$row]['date'] = strtotime($data_value);

                    }
                    else
                    {
                        $arr_data[$row]['date'] = PHPExcel_Shared_Date::ExcelToPHP($data_value);
                    }
                    //  echo " Date ".$arr_data[$row]['date']." ";

                }
                if($column == "B")
                    $arr_data[$row]['ref'] = $data_value;
                if($column == "C")
                    $arr_data[$row]['narration'] = $data_value;
                if( $column == "D")
                    $arr_data[$row]['amount'] = $data_value;

            }
        }
        $fin_data = array();
        $sum = 0.00;

        foreach($arr_data as $arr_val)
        {

            //trying to skip empty spaces
            if(!isset($arr_val['date']) && !isset($arr_val['ref']) && !isset($arr_val['narration']) && !isset($arr_val['amount']))
            {

            }
            else
                if
                ( (isset($arr_val['date']) && $arr_val['date'] =="") && (isset($arr_val['ref']) && $arr_val['ref'] =="") && (isset($arr_val['narration']) && $arr_val['narration']=="")  && (isset($arr_val['amount']) && $arr_val['amount']==""))
                {

                }
                else
                {
                    //check the vals that have not been set and set them or put a diffult in;
                    if(!isset($arr_val['date']))
                    {
                        $arr_val['date'] = date('Y-m-d h:i:s',time());
                    }
                    else
                    {
                        //echo "Raw date = ".$arr_val['date']." Converted date = ". date('Y-m-d h:i:s',$arr_val['date']);
                        $arr_val['date'] = date('Y-m-d h:i:s',($arr_val['date']));

                    }
                    if(!isset($arr_val['ref']))
                    {
                        $arr_val['ref'] = "";
                    }

                    if(!isset($arr_val['narration']))
                    {
                        $arr_val['narration'] = "";
                    }
                    if(!isset($arr_val['amount']))
                    {
                        $arr_val['amount'] = 0.00;
                    }
                    $arr_val['id_user'] = $this->user['id'];
                    $arr_val['id_account'] = $this->input->post('id_account');
                    $arr_val['transaction_from'] = $this->session->transaction_from;
                    $arr_val['transaction_type'] = $this->session->transaction_type;

                    //check transaction from if it cash book
                    $sum += $arr_val['amount'];

                    $fin_data[sizeof($fin_data)] = $arr_val;
                }



        }
        if(sizeof($fin_data) > 0);
        $this->db->insert_batch('transactions', $fin_data);

        if($this->session->transaction_from == 2)
        {

            // get last reconciliation of this cash book
            $last_recon = $this->site_model->check_new_reconciliation($this->input->post('id_account'));
            //check transaction type
            $closing_balance =0;
            if(sizeof($last_recon) == 0)
            {
                $temp = $this->site_model->get_account($this->input->post('id_account'));
                //get value from the accounts as there are no reconciliations
                $last_recon['cashbook_closing_balance'] = $temp['cashbook_closing_balance'];
            }
            if($this->session->transaction_type == 1)
            {
                //debit add
                //subtract or add to the opening balance save to closing balance
//                    echo 'debit = '.round(floatval($sum),2);
//                    echo '\n calculation '.floatval($last_recon['cashbook_open_balance']).' + '.round(floatval($sum),2);

                $closing_balance = floatval($last_recon['cashbook_open_balance']) +  round(floatval($sum),2);
//                    echo '\n response '.$closing_balance;
            }
            elseif($this->session->transaction_type == 2)
            {
                //credit subtract
                //subtract or add to the opening balance save to closing balance
//                    echo ' credit = '.round(floatval($sum),2);
//                    echo '\n calculation '.floatval($last_recon['cashbook_closing_balance']).' - '.round(floatval($sum),2);

                $closing_balance = floatval($last_recon['cashbook_closing_balance']) - round(floatval($sum),2);
//                    echo '\n response '.$closing_balance;

            }
            $data = array('cashbook_closing_balance'=>$closing_balance);
            $this->site_model->update_recon($last_recon['id'],$data);
        }
            echo json_encode(array('status'=>'success'));

        }
        else
        {
            echo json_encode(array('status'=>'error','error'=>"Please Re-Upload The File"));
        }

    }
    function edit_comment()
    {
        $this->site_model->edit_comment($this->input->post('id'),$this->input->post('comment',true));
        echo json_encode(array('status'=>'success'));
    }


    function export_excel()
    {
        $recon = $this->site_model->get_recon($this->uri->segment(3));
        $account = $this->site_model->get_account($recon['id_account']);
        $company = $this->site_model->get_company($this->user['id_company']);
        $recon_data = $recon;

        if(isset($_GET['closed_recon']) && $_GET['closed_recon'] == 1 )
        {

            $bdebit = $this->site_model->take_out_checked($this->site_model->v_prepare_debit_bank_statement($account['id']),$recon['id'],$recon['max_transaction']);
            $ccredit = $this->site_model->take_out_checked($this->site_model->v_prepare_credit_cashbook($account['id']),$recon['id'],$recon['max_transaction']);
            $bcredit = $this->site_model->take_out_checked($this->site_model->v_prepare_credit_bank_statement($account['id']),$recon['id'],$recon['max_transaction']);
            $cdebit = $this->site_model->take_out_checked($this->site_model->v_prepare_debit_cashbook($account['id']),$recon['id'],$recon['max_transaction']);
            $adjusted_bank = $this->site_model->get_adjusted_bank($recon['bank_closing_balance'],$bdebit,$cdebit);
            $adjusted_cash = $this->site_model->get_adjusted_cashbook($recon['cashbook_closing_balance'],$bcredit,$ccredit);

        }
        else
        {
            $bdebit= $this->site_model->prepare_debit_bank_statement($account['id']);
            $ccredit = $this->site_model->prepare_credit_cashbook($account['id']);
            $bcredit = $this->site_model->prepare_credit_bank_statement($account['id']);
            $cdebit = $this->site_model->prepare_debit_cashbook($account['id']);
            $bank_statement_total = 0.00;
            $cashbook_statement_total = 0.00;
            $adjusted_bank = $this->site_model->get_adjusted_bank($recon['bank_closing_balance'],$bdebit,$cdebit);
            $adjusted_cash = $this->site_model->get_adjusted_cashbook($recon['cashbook_closing_balance'],$bcredit,$ccredit);

        }

      //load our new PHPExcel library
        $this->load->library('excel');
//activate worksheet number 1
        $this->excel->setActiveSheetIndex(0);
//name the worksheet
        $this->excel->getActiveSheet()->setTitle('print_preview');
//set cell A1 content with some text
        $this->excel->getActiveSheet()->setCellValue('A1',  $company['name']);
//change the font size
        $this->excel->getActiveSheet()->getStyle('A1')->getFont()->setSize(12);
//make the font become bold
        $this->excel->getActiveSheet()->getStyle('A1')->getFont()->setBold(true);
//merge cell A1 until D1
        $this->excel->getActiveSheet()->mergeCells('A1:D2');
//set cell A1 content with some text
        $this->excel->getActiveSheet()->setCellValue('A3', 'Bank Reconciliation statement for '.$account['account_name'].' for the month of '. $recon_data['month']);
//change the font size
        $this->excel->getActiveSheet()->getStyle('A3')->getFont()->setSize(12);
//make the font become bold
        $this->excel->getActiveSheet()->getStyle('A3')->getFont()->setBold(true);
//merge cell A1 until D1
        $this->excel->getActiveSheet()->mergeCells('A3:K3');
        //
        $bank_statement_total = 0.00;
        $cashbook_statement_total = 0.00;
        $max=6;
        //set cell A1 content with some text
        $this->excel->getActiveSheet()->setCellValue('A6', 'BALANCE AS PER CASH BOOK : GhC '.number_format($recon_data['cashbook_closing_balance'],2,'.',','));
        $cashbook_statement_total = $recon_data['cashbook_closing_balance'];
//change the font size
        $this->excel->getActiveSheet()->getStyle('A6')->getFont()->setSize(10);
//make the font become bold
        $this->excel->getActiveSheet()->getStyle('A6')->getFont()->setBold(true);
//merge cell A1 until D1
        $this->excel->getActiveSheet()->mergeCells('A6:E7');
        //
        $this->excel->getActiveSheet()->setCellValue('H6', 'BALANCE AS PER BANK STATEMENT : GhC '.number_format($recon_data['bank_closing_balance'],2,'.',','));
        $bank_statement_total = $recon_data['bank_closing_balance'];
//change the font size
        $this->excel->getActiveSheet()->getStyle('H6')->getFont()->setSize(10);
//make the font become bold
        $this->excel->getActiveSheet()->getStyle('H6')->getFont()->setBold(true);
//merge cell A1 until D1
        $this->excel->getActiveSheet()->mergeCells('H6:L7');
        //
       // setting the first two headers
        $last=0;
        $this->excel->getActiveSheet()->setCellValue('A11', 'Date');
        $this->excel->getActiveSheet()->getStyle('A11')->getFont()->setSize(8);
        $this->excel->getActiveSheet()->getStyle('A11')->getFont()->setBold(true);
        $this->excel->getActiveSheet()->setCellValue('B11', 'Ref');
        $this->excel->getActiveSheet()->getStyle('B11')->getFont()->setSize(8);
        $this->excel->getActiveSheet()->getStyle('B11')->getFont()->setBold(true);
        $this->excel->getActiveSheet()->setCellValue('C11', 'Narration');
        $this->excel->getActiveSheet()->getStyle('C11')->getFont()->setSize(8);
        $this->excel->getActiveSheet()->getStyle('C11')->getFont()->setBold(true);
        $this->excel->getActiveSheet()->setCellValue('D11', 'Amount');
        $this->excel->getActiveSheet()->getStyle('D11')->getFont()->setSize(8);
        $this->excel->getActiveSheet()->getStyle('D11')->getFont()->setBold(true);
        $this->excel->getActiveSheet()->setCellValue('E11', 'Comment');
        $this->excel->getActiveSheet()->getStyle('E11')->getFont()->setSize(8);
        $this->excel->getActiveSheet()->getStyle('E11')->getFont()->setBold(true);
        $this->excel->getActiveSheet()->setCellValue('H11', 'Date');
        $this->excel->getActiveSheet()->getStyle('H11')->getFont()->setSize(8);
        $this->excel->getActiveSheet()->getStyle('H11')->getFont()->setBold(true);
        $this->excel->getActiveSheet()->setCellValue('I11', 'Ref');
        $this->excel->getActiveSheet()->getStyle('I11')->getFont()->setSize(8);
        $this->excel->getActiveSheet()->getStyle('I11')->getFont()->setBold(true);
        $this->excel->getActiveSheet()->setCellValue('J11', 'Narration');
        $this->excel->getActiveSheet()->getStyle('J11')->getFont()->setSize(8);
        $this->excel->getActiveSheet()->getStyle('J11')->getFont()->setBold(true);
        $this->excel->getActiveSheet()->setCellValue('K11', 'Amount');
        $this->excel->getActiveSheet()->getStyle('K11')->getFont()->setSize(8);
        $this->excel->getActiveSheet()->getStyle('K11')->getFont()->setBold(true);
        $this->excel->getActiveSheet()->setCellValue('L11', 'Comment');
        $this->excel->getActiveSheet()->getStyle('L11')->getFont()->setSize(8);
        $this->excel->getActiveSheet()->getStyle('L11')->getFont()->setBold(true);
        //insert the cashbook credit
        $cell = 10;
        $this->excel->getActiveSheet()->setCellValue('A'.$cell, 'Cashbook Credits');
        $sub = 0.00;
//change the font size
        $this->excel->getActiveSheet()->getStyle('A'.$cell)->getFont()->setSize(10);
//make the font become bold
        $this->excel->getActiveSheet()->getStyle('A'.$cell)->getFont()->setBold(true);
        $this->excel->getActiveSheet()->mergeCells('A'.$cell.':E'.$cell);

        $sub = 0.00;
        $i = 0;
        $cashbook_statement_total = $recon_data['cashbook_closing_balance'];
        for($i=0;$i<sizeof($ccredit); $i++)
        {
            $transaction = $ccredit[$i];
            // setting the first two headers
            $cell = $i+12;
            $d = date('d M, Y',strtotime($transaction['date']));
            $this->excel->getActiveSheet()->setCellValue('A'.$cell,$d);
            $this->excel->getActiveSheet()->getStyle('A'.$cell)->getFont()->setSize(8);
            $this->excel->getActiveSheet()->setCellValue('B'.$cell, $transaction['ref']);
            $this->excel->getActiveSheet()->getStyle('B'.$cell)->getFont()->setSize(8);
            $this->excel->getActiveSheet()->setCellValue('C'.$cell, $transaction['narration'] );
            $this->excel->getActiveSheet()->getStyle('C'.$cell)->getFont()->setSize(8);
            $this->excel->getActiveSheet()->setCellValue('D'.$cell, number_format($transaction['amount'],2,'.',','));
            $cashbook_statement_total += $transaction['amount']; $sub += $transaction['amount'];
            $this->excel->getActiveSheet()->getStyle('D'.$cell)->getFont()->setSize(8);

            if($transaction['comment'] != "No Comment Yet")
            {
               $this->excel->getActiveSheet()->setCellValue('E'.$cell, $transaction['comment']);
                $this->excel->getActiveSheet()->getStyle('E'.$cell)->getFont()->setSize(8);
            }

        }
        $cell = $i+13;
        $this->excel->getActiveSheet()->setCellValue('A'.$cell, 'Sub - Total Ghc '. number_format($sub,2,'.',','));
        $sub = 0.00;
//change the font size
        $this->excel->getActiveSheet()->getStyle('A'.$cell)->getFont()->setSize(10);
//make the font become bold
        $this->excel->getActiveSheet()->getStyle('A'.$cell)->getFont()->setBold(true);
        $this->excel->getActiveSheet()->mergeCells('A'.$cell.':E'.$cell);



//merge cell A1 until D1
        //
        //insert the BankStatement Debit
        $cell = 10;
        $this->excel->getActiveSheet()->setCellValue('H'.$cell, 'Bank Statement Debits ');
        $sub = 0.00;
//change the font size
        $this->excel->getActiveSheet()->getStyle('H'.$cell)->getFont()->setSize(10);
//make the font become bold
        $this->excel->getActiveSheet()->getStyle('H'.$cell)->getFont()->setBold(true);
        $this->excel->getActiveSheet()->mergeCells('H'.$cell.':L'.$cell);

        $sub = 0.00;
        $i = 0;
        $bank_statement_total = $recon_data['bank_closing_balance'];
        for($i=0;$i<sizeof($bdebit); $i++)
        {
            $transaction = $bdebit[$i];
            // setting the first two headers
            $cell = $i+11+1;
            $d = date('d M, Y',strtotime($transaction['date']));
            $this->excel->getActiveSheet()->setCellValue('H'.$cell,$d);
            $this->excel->getActiveSheet()->getStyle('H'.$cell)->getFont()->setSize(8);
            $this->excel->getActiveSheet()->setCellValue('I'.$cell, $transaction['ref']);
            $this->excel->getActiveSheet()->getStyle('I'.$cell)->getFont()->setSize(8);
            $this->excel->getActiveSheet()->setCellValue('J'.$cell, $transaction['narration'] );
            $this->excel->getActiveSheet()->getStyle('J'.$cell)->getFont()->setSize(8);
            $this->excel->getActiveSheet()->setCellValue('K'.$cell, number_format($transaction['amount'],2,'.',','));
            $bank_statement_total += $transaction['amount'];$sub += $transaction['amount'];
            $this->excel->getActiveSheet()->getStyle('K'.$cell)->getFont()->setSize(8);

            if($transaction['comment'] != "No Comment Yet")
            {
                $this->excel->getActiveSheet()->setCellValue('L'.$cell, $transaction['comment']);
                $this->excel->getActiveSheet()->getStyle('L'.$cell)->getFont()->setSize(8);
            }

        }
        $cell = $i+13;
        $this->excel->getActiveSheet()->setCellValue('H'.$cell, 'Sub - Total Ghc '. number_format($sub,2,'.',','));
        $sub = 0.00;
//change the font size
        $this->excel->getActiveSheet()->getStyle('H'.$cell)->getFont()->setSize(10);
//make the font become bold
        $this->excel->getActiveSheet()->getStyle('H'.$cell)->getFont()->setBold(true);
        $this->excel->getActiveSheet()->mergeCells('H'.$cell.':L'.$cell);


        $max = sizeof($bdebit);
        if(sizeof($ccredit) > sizeof($bdebit))
            $max = sizeof($ccredit);

        $max = $max + 5 + 11;
        $this->excel->getActiveSheet()->setCellValue('A'.$max, 'Date');
        $this->excel->getActiveSheet()->getStyle('A'.$max)->getFont()->setBold(true);
        $this->excel->getActiveSheet()->getStyle('A'.$max)->getFont()->setSize(8);
        $this->excel->getActiveSheet()->setCellValue('B'.$max, 'Ref');
        $this->excel->getActiveSheet()->getStyle('B'.$max)->getFont()->setSize(8);
        $this->excel->getActiveSheet()->getStyle('B'.$max)->getFont()->setBold(true);
        $this->excel->getActiveSheet()->setCellValue('C'.$max, 'Narration');
        $this->excel->getActiveSheet()->getStyle('C'.$max)->getFont()->setSize(8);
        $this->excel->getActiveSheet()->getStyle('C'.$max)->getFont()->setBold(true);
        $this->excel->getActiveSheet()->setCellValue('D'.$max, 'Amount');
        $this->excel->getActiveSheet()->getStyle('D'.$max)->getFont()->setSize(8);
        $this->excel->getActiveSheet()->getStyle('D'.$max)->getFont()->setBold(true);
        $this->excel->getActiveSheet()->setCellValue('E'.$max, 'Comment');
        $this->excel->getActiveSheet()->getStyle('E'.$max)->getFont()->setSize(8);
        $this->excel->getActiveSheet()->getStyle('E'.$max)->getFont()->setBold(true);
        $this->excel->getActiveSheet()->setCellValue('H'.$max, 'Date');
        $this->excel->getActiveSheet()->getStyle('H'.$max)->getFont()->setSize(8);
        $this->excel->getActiveSheet()->getStyle('H'.$max)->getFont()->setBold(true);
        $this->excel->getActiveSheet()->setCellValue('I'.$max, 'Ref');
        $this->excel->getActiveSheet()->getStyle('I'.$max)->getFont()->setSize(8);
        $this->excel->getActiveSheet()->getStyle('I'.$max)->getFont()->setBold(true);
        $this->excel->getActiveSheet()->setCellValue('J'.$max, 'Narration');
        $this->excel->getActiveSheet()->getStyle('J'.$max)->getFont()->setSize(8);
        $this->excel->getActiveSheet()->getStyle('J'.$max)->getFont()->setBold(true);
        $this->excel->getActiveSheet()->setCellValue('K'.$max, 'Amount');
        $this->excel->getActiveSheet()->getStyle('K'.$max)->getFont()->setSize(8);
        $this->excel->getActiveSheet()->getStyle('K'.$max)->getFont()->setBold(true);
        $this->excel->getActiveSheet()->setCellValue('L'.$max, 'Comment');
        $this->excel->getActiveSheet()->getStyle('L'.$max)->getFont()->setSize(8);
        $this->excel->getActiveSheet()->getStyle('L'.$max)->getFont()->setBold(true);

        //insert the cashbook debit
        $cell = $max-1;
        $this->excel->getActiveSheet()->setCellValue('A'.$cell, 'CASH BOOK DEBITS');
        $sub = 0.00;
//change the font size
        $this->excel->getActiveSheet()->getStyle('A'.$cell)->getFont()->setSize(8);
//make the font become bold
        $this->excel->getActiveSheet()->getStyle('A'.$cell)->getFont()->setBold(true);
        $this->excel->getActiveSheet()->mergeCells('A'.$cell.':E'.$cell);


        $sub = 0.00;
        $i = 0;
        for($i=0;$i<sizeof($cdebit); $i++)
        {
            $transaction = $cdebit[$i];
            // setting the first two headers
            $cell = $i+1+$max;
            $d = date('d M, Y',strtotime($transaction['date']));
            $this->excel->getActiveSheet()->setCellValue('A'.$cell,$d);
            $this->excel->getActiveSheet()->getStyle('A'.$cell)->getFont()->setSize(8);
            $this->excel->getActiveSheet()->setCellValue('B'.$cell, $transaction['ref']);
            $this->excel->getActiveSheet()->getStyle('B'.$cell)->getFont()->setSize(8);
            $this->excel->getActiveSheet()->setCellValue('C'.$cell, $transaction['narration'] );
            $this->excel->getActiveSheet()->getStyle('C'.$cell)->getFont()->setSize(8);
            $this->excel->getActiveSheet()->setCellValue('D'.$cell, number_format($transaction['amount'],2,'.',','));
            $cashbook_statement_total += $transaction['amount'];
            $sub += $transaction['amount'];
            $this->excel->getActiveSheet()->getStyle('D'.$cell)->getFont()->setSize(8);

            if($transaction['comment'] != "No Comment Yet")
            {
                $this->excel->getActiveSheet()->setCellValue('E'.$cell, $transaction['comment']);
                $this->excel->getActiveSheet()->getStyle('E'.$cell)->getFont()->setSize(8);
            }

        }
        $cell = $i+3+$max;
        $this->excel->getActiveSheet()->setCellValue('A'.$cell, 'Sub - Total Ghc '. number_format($sub,2,'.',','));
        $sub = 0.00;
//change the font size
        $this->excel->getActiveSheet()->getStyle('A'.$cell)->getFont()->setSize(10);
//make the font become bold
        $this->excel->getActiveSheet()->getStyle('A'.$cell)->getFont()->setBold(true);
        $this->excel->getActiveSheet()->mergeCells('A'.$cell.':E'.$cell);

        $cell += 4;
        $this->excel->getActiveSheet()->setCellValue('A'.$cell, 'Adjusted Balance : Ghc '.number_format(floatval($adjusted_cash),2,'.',','));
        $sub = 0.00;
//change the font size
        $this->excel->getActiveSheet()->getStyle('A'.$cell)->getFont()->setSize(10);
//make the font become bold
        $this->excel->getActiveSheet()->getStyle('A'.$cell)->getFont()->setBold(true);
        $this->excel->getActiveSheet()->mergeCells('A'.$cell.':E'.$cell);
        //set last equals this cell and later compare if the other cell is bigger
        $last = $cell;

        //insert the BankStatement credits
        $sub = 0.00;
        $i = 0;
        $cell = $max-1;
        $this->excel->getActiveSheet()->setCellValue('H'.$cell, 'BANK STATEMENT CREDITS');
        $sub = 0.00;
//change the font size
        $this->excel->getActiveSheet()->getStyle('H'.$cell)->getFont()->setSize(8);
//make the font become bold
        $this->excel->getActiveSheet()->getStyle('H'.$cell)->getFont()->setBold(true);
        $this->excel->getActiveSheet()->mergeCells('H'.$cell.':L'.$cell);


        for($i=0;$i<sizeof($bcredit); $i++)
        {
            $transaction = $bcredit[$i];
            // setting the first two headers
            $cell = $i+1+$max;
            $d = date('d M, Y',strtotime($transaction['date']));
            $this->excel->getActiveSheet()->setCellValue('H'.$cell,$d);
            $this->excel->getActiveSheet()->getStyle('H'.$cell)->getFont()->setSize(8);
            $this->excel->getActiveSheet()->setCellValue('I'.$cell, $transaction['ref']);
            $this->excel->getActiveSheet()->getStyle('I'.$cell)->getFont()->setSize(8);
            $this->excel->getActiveSheet()->setCellValue('J'.$cell, $transaction['narration'] );
            $this->excel->getActiveSheet()->getStyle('J'.$cell)->getFont()->setSize(8);
            $this->excel->getActiveSheet()->setCellValue('K'.$cell, number_format($transaction['amount'],2,'.',','));
            $bank_statement_total += $transaction['amount'];$sub += $transaction['amount'];
            $this->excel->getActiveSheet()->getStyle('K'.$cell)->getFont()->setSize(8);

            if($transaction['comment'] != "No Comment Yet")
            {
                $this->excel->getActiveSheet()->setCellValue('L'.$cell, $transaction['comment']);
                $this->excel->getActiveSheet()->getStyle('L'.$cell)->getFont()->setSize(8);
            }

        }

        $cell = $i+3+$max;
        $this->excel->getActiveSheet()->setCellValue('H'.$cell, 'Sub - Total Ghc '. number_format($sub,2,'.',','));
        $sub = 0.00;
//change the font size
        $this->excel->getActiveSheet()->getStyle('H'.$cell)->getFont()->setSize(10);
//make the font become bold
        $this->excel->getActiveSheet()->getStyle('H'.$cell)->getFont()->setBold(true);
        $this->excel->getActiveSheet()->mergeCells('H'.$cell.':L'.$cell);

        $cell += 4;
        $this->excel->getActiveSheet()->setCellValue('H'.$cell, 'Adjusted Balance : Ghc '.number_format(floatval($adjusted_bank),2,'.',','));
        $sub = 0.00;
//change the font size
        $this->excel->getActiveSheet()->getStyle('H'.$cell)->getFont()->setSize(10);
//make the font become bold
        $this->excel->getActiveSheet()->getStyle('H'.$cell)->getFont()->setBold(true);
        $this->excel->getActiveSheet()->mergeCells('H'.$cell.':L'.$cell);

        if($cell > $last)
            $last = $cell;


        $cell = $last +4;
        $this->excel->getActiveSheet()->setCellValue('H'.$cell, 'Approved By:');
        $sub = 0.00;
//change the font size
        $this->excel->getActiveSheet()->getStyle('H'.$cell)->getFont()->setSize(10);
//make the font become bold
        $this->excel->getActiveSheet()->getStyle('H'.$cell)->getFont()->setBold(true);
        $this->excel->getActiveSheet()->mergeCells('H'.$cell.':L'.$cell);
        $cell+=1;
        $this->excel->getActiveSheet()->setCellValue('H'.$cell, 'Name:');
        $sub = 0.00;
//change the font size
        $this->excel->getActiveSheet()->getStyle('H'.$cell)->getFont()->setSize(10);
//make the font become bold
        $this->excel->getActiveSheet()->getStyle('H'.$cell)->getFont()->setBold(true);
        $this->excel->getActiveSheet()->mergeCells('H'.$cell.':L'.$cell);

        $cell+=2;
        $this->excel->getActiveSheet()->setCellValue('H'.$cell, 'Signature:');
        $sub = 0.00;
//change the font size
        $this->excel->getActiveSheet()->getStyle('H'.$cell)->getFont()->setSize(10);
//make the font become bold
        $this->excel->getActiveSheet()->getStyle('H'.$cell)->getFont()->setBold(true);
        $this->excel->getActiveSheet()->mergeCells('H'.$cell.':L'.$cell);


        $cell = $last +4;
        $this->excel->getActiveSheet()->setCellValue('A'.$cell, 'Prepared By:');
        $sub = 0.00;
//change the font size
        $this->excel->getActiveSheet()->getStyle('A'.$cell)->getFont()->setSize(10);
//make the font become bold
        $this->excel->getActiveSheet()->getStyle('A'.$cell)->getFont()->setBold(true);
        $this->excel->getActiveSheet()->mergeCells('A'.$cell.':E'.$cell);
        $cell+=1;
        $this->excel->getActiveSheet()->setCellValue('A'.$cell, 'Name:');
        $sub = 0.00;
//change the font size
        $this->excel->getActiveSheet()->getStyle('A'.$cell)->getFont()->setSize(10);
//make the font become bold
        $this->excel->getActiveSheet()->getStyle('A'.$cell)->getFont()->setBold(true);
        $this->excel->getActiveSheet()->mergeCells('A'.$cell.':E'.$cell);

        $cell+=2;
        $this->excel->getActiveSheet()->setCellValue('A'.$cell, 'Signature:');
        $sub = 0.00;
//change the font size
        $this->excel->getActiveSheet()->getStyle('A'.$cell)->getFont()->setSize(10);
//make the font become bold
        $this->excel->getActiveSheet()->getStyle('A'.$cell)->getFont()->setBold(true);
        $this->excel->getActiveSheet()->mergeCells('A'.$cell.':E'.$cell);


//set aligment to center for that merged cell (A1 to D1)
        $this->excel->getActiveSheet()->getStyle('A1')->getAlignment()->setHorizontal(PHPExcel_Style_Alignment::HORIZONTAL_CENTER);
        $this->excel->getActiveSheet()->getStyle('A3')->getAlignment()->setHorizontal(PHPExcel_Style_Alignment::HORIZONTAL_CENTER);
        $filename='recon exported on '.date("d, M Y @ h:i",time()).'.xls'; //save our workbook as this file name
        header('Content-Type: application/vnd.ms-excel'); //mime type
        header('Content-Disposition: attachment;filename="'.$filename.'"'); //tell browser what's the file name
        header('Cache-Control: max-age=0'); //no cache

//save it to Excel5 format (excel 2003 .XLS file), change this to 'Excel2007' (and adjust the filename extension, also the header mime type)
//if you want to save it as .XLSX Excel 2007 format
        $objWriter = PHPExcel_IOFactory::createWriter($this->excel, 'Excel5');
//force user to download the Excel file without writing it to server's HD
        $objWriter->save('php://output');
    }

    public function restore()
    {
        $restore_point= $this->site_model->check_restore_reconciliation($_POST['id']);
        $current = $this->site_model->check_new_reconciliation($_POST['id']);
        if(sizeof($restore_point) != 1)
        {
            if($restore_point['max_transaction']>0)
            {
                //delete all transactions belonging to that account greater than last closed recon
                $this->site_model->delete_transactions($restore_point['max_transaction'],$restore_point['id_account']);
                // delete current recon
                $this->site_model->delete_recon($current['id']);
                //reopen last recon
                $this->site_model->reopen_recon($restore_point['id']);
            }

            echo json_encode(array('status'=>'success','error'=>'Restoration Complete'));

        }
        else
        {
            echo json_encode(array('status'=>'error','error'=>'Sorry No Restoration Point Found'));

        }

    }

    public function undo_checks()
    {
        $restore_point= $this->site_model->check_restore_reconciliation($_POST['id']);
        $current = $this->site_model->check_new_reconciliation($_POST['id']);
        if(sizeof($restore_point) != 1)
        {
            //get the bank closing
            // get bank closing and opening
            //uncheck all of the checked with the current recon id
            //replace the bank closing and opening details as they are important and forget the cash book details

        }
        else
        {
            //first recon

           // get account details

            // get bank closing and opening
            //uncheck all of the checked with the current recon id
            //replace the bank closing and opening details as they are important and forget the cash book details

        }
    }
    public function back_up()
    {
        if($this->site_model->check_can_back_up())
        {
            $this->load->dbutil();

            $prefs = array(
                'tables'      => array('reconciliations', 'transactions','users','accounts'),
                'format'      => 'zip',
                'filename'    => 'my_db_backup.sql'
            );

            $backup = $this->dbutil->backup($prefs);

            $db_name = 'backup-on-'. date("Y-m-d H-i-s") .'.zip';
            $save = '/opt/lampp/htdocs/'.$db_name;

            $this->load->helper('file');
            write_file($save, $backup);
            $this->site_model->back_up($save);
        }


      //  $this->load->helper('download');
      //  force_download($db_name, $backup);
    }


}
