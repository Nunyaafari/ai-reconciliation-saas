<?php
/**
 * Created by PhpStorm.
 * User: root
 * VK7JG-NPHTM-C97JM-9MPGT-3V66T
 * Date: 4/23/15
 * Time: 9:38 PM
 */
defined('BASEPATH') OR exit('No direct script access allowed');

class site_model extends CI_Model{
    /**
     * Register user
     * @param $data
     * @return mixed
     *
     */
    public function register_user($data){
        $this->db->insert('users',$data);
        return $this->db->insert_id();
    }

    /***
     * Indicate user is online
     * @param $id
     * @param $unique
     */
    public function mark_online($id,$unique){
        $this->db->where(array('id'=>$id));
        $this->db->update('users',array('logged_in'=>1,'unique_id'=>$unique));
    }

    public function get_user($id){
        $this->db->where(array('id'=>$id));
        $res = $this->db->get('users')->result_array();
        if(sizeof($res) != 0){
            return $res[0];
        }
        return $res;
    }

    public function logout(){
        $this->db->where(array('id'=>$this->session->user_id));

        $this->db->update('users',array('logged_in'=>0,'unique_id'=>"",'locked'=>0));
    }

    public function get_company($id){
        $this->db->where(array('id'=>$id));
        $res = $this->db->get('companies')->result_array();
        if(sizeof($res) != 0){
            return $res[0];
        }
        return $res;
    }

    public function unlock($password)
    {

        $user = $this->get_user($this->session->user_id);
        if(sizeof($user) != 0){
            if($this->hasher->validate($password,$user['password']))
                return true;
            return false;
        }

        return false;


    }

    public function get_all_companies()
    {
        $this->db->where(array('is_active' => 1));
      return  $this->db->get('companies')->result_array();
    }

    public function add_company($data)
    {

        $this->db->insert('companies',$data);
        return $this->db->insert_id();

    }

    public  function  update_company($id,$data)
    {
        $this->db->where(array('id'=>$id));
        $this->db->update('companies',$data);

    }

    public function get_company_users($id)
    {
        $this->db->where(array('id_company'=>$id));
        return $this->db->get('users')->result_array();

    }

    public function get_all_users()
    {
        $this->db->where(array('user_role !='=>-5));
        return $this->db->get('users')->result_array();

    }
    public function update_user($id,$data)
    {
        $this->db->where(array('id'=>$id));
        $this->db->update('users',$data);

    }

    public function add_account($data)
    {
        $this->db->insert('accounts',$data);
        return $this->db->insert_id();
    }

    public function update_account($id,$data)
    {
        $this->db->where(array('id'=>$id));
        $this->db->update('accounts',$data);
    }
    public function delete_account($id,$data)
    {
        $this->db->where(array('id'=>$id));
        $this->db->delete('accounts');
    }

    public function update_recon($id,$data)
    {
        $this->db->where(array('id'=>$id));
        $this->db->update('reconciliations',$data);
    }

    public function get_user_accounts($id)
    {
        $this->db->where(array('id_user'=>$id));
        return $this->db->get('accounts')->result_array();

    }

    public function get_all_accounts()
    {
        return $this->db->get('accounts')->result_array();

    }

    public function get_account($id)
    {
        $this->db->where(array('id'=>$id));
        $resp =  $this->db->get('accounts')->result_array();
        if(sizeof($resp) > 0)
        {
            $resp = $resp[0];
        }
        return $resp;
    }
    public function get_company_accounts($id)
    {
        //get all company users
        $company_users = $this->get_company_users($id);
        $accounts = array();
        foreach($company_users as $company_user)
        {
            //loop through and get accounts for all users
            $temp = $this->get_user_accounts($company_user['id']);
            if(sizeof($temp) != 0)
            {
                $accounts[sizeof($accounts)] = $temp;
            }
        }

        return $accounts;

    }

    public function prepare_companies()
    {
        $companies = $this->get_all_companies();
        $resp = array();

        foreach($companies as $company)
        {
            // get company accounts
            $company_accounts = $this->get_company_accounts($company['id']);

            // get number of users
            $company_users = $this->get_company_users($company['id']);
            $company['num_users'] = sizeof($company_users);
            $company['num_accounts'] = sizeof($company_accounts);
            $resp[sizeof($resp)] = $company;
        }

        return $resp;


    }

    public function prepare_admin_users(){
        $users = $this->get_all_users();
        $resp = array();

        foreach($users as $user){
            $user_company = $this->get_company($user['id_company']);
            if(sizeof($user_company) !=0 && $user_company['is_active'] == 1){
                $user['num_accounts'] = sizeof($this->get_user_accounts($user['id']));
                $user['company'] = $user_company['name'];
                if($user['user_role'] == 1){
                    $user['role'] = 'Company User';
                }
                elseif($user['user_role'] == 1)
                {
                    $user['role'] = 'Company Administrator';
                }

                $resp[sizeof($resp)] = $user;
            }

        }

        return $resp;
    }
    public function prepare_company_users($id){
    $users = $this->get_company_users($id);
        $resp = array();

        foreach($users as $user){
            $user_company = $this->get_company($user['id_company']);
            if(sizeof($user_company)!=0 && $user_company['is_active'] == 1){
                $user['num_accounts'] = sizeof($this->get_user_accounts($user['id']));
                $user['company'] = $user_company['name'];
                if($user['user_role'] == 1){
                    $user['role'] = 'Company User';
                }
                elseif($user['user_role'] == 1)
                {
                    $user['role'] = 'Company Administrator';
                }

                $resp[sizeof($resp)] = $user;
            }

        }

        return $resp;

    }
    public function get_company_accounts_only($id){
        $this->db->where(array('id_company'=>$id));
        return $this->db->get('accounts')->result_array();
    }

    public function prepare_accounts($id=0)
    {
        $accounts = $this->get_all_accounts();
        if($id != 0)
        {
         $accounts = $this->get_company_accounts_only($id);
        }
        $resp = array();
        foreach($accounts as $account)
        {
            $recon = $this->db->get_where('reconciliations',array('id_account'=>$account['id']))->result_array();
            $user = $this->get_user($account['id_user']);
            $account['user_name'] = $user['fullname'];
            $account['setup'] = true;
            if(sizeof($recon) > 0)
                $account['setup'] = false;
            $resp[sizeof($resp)] = $account;
        }

        return $resp;

    }
   public function prepare_user_accounts($id=0)
    {

         $accounts = $this->get_user_accounts($id);

        $resp = array();
        foreach($accounts as $account)
        {
            $recon = $this->db->get_where('reconciliations',array('id_account'=>$account['id']))->result_array();
            $user = $this->get_user($account['id_user']);
            $account['user_name'] = $user['fullname'];
            $account['setup'] = true;
            if(sizeof($recon) > 0)
                $account['setup'] = false;
            $resp[sizeof($resp)] = $account;
        }

        return $resp;


    }
    public function new_transaction($data)
    {

        $this->db->insert('transactions',$data);
        return $this->db->insert_id();

    }

    public function get_bank_debit_unchecked($id)
    {
        $this->db->where(array('id_account'=>$id,'transaction_type'=>1,'transaction_from'=>1,'is_checked'=>0));
        return $this->db->get('transactions')->result_array();
    }

    public function get_bank_credit_unchecked($id)
    {
        $this->db->where(array('id_account'=>$id,'transaction_type'=>2,'transaction_from'=>1,'is_checked'=>0));
        return $this->db->get('transactions')->result_array();

    }

    public function get_cashbook_debit_unchecked($id)
    {
        $this->db->where(array('id_account'=>$id,'transaction_type'=>1,'transaction_from'=>2,'is_checked'=>0));
        return $this->db->get('transactions')->result_array();
    }

    public function get_cashbook_credit_unchecked($id)
    {
        $this->db->where(array('id_account'=>$id,'transaction_type'=>2,'transaction_from'=>2,'is_checked'=>0));
        return  $this->db->get('transactions')->result_array();
    }

    public function prepare_debit_bank_statement($id)
    {
        $account = $this->get_account($id);

        /**
         * Assuming balance is the total amount left to check out
         */

        return $this->get_bank_debit_unchecked($id);

    }

    public function v_prepare_debit_bank_statement($id)
    {

        /**
         * Assuming balance is the total amount left to check out
         */
        $this->db->where(array('id_account'=>$id,'transaction_type'=>1,'transaction_from'=>1));
        return $this->db->get('transactions')->result_array();

      //  return $this->v_get_bank_debit_unchecked($id);

    }

    public function prepare_credit_bank_statement($id)
    {
        $account = $this->get_account($id);

        return $this->get_bank_credit_unchecked($id);

    }

    public function v_prepare_credit_bank_statement($id)
    {

        $this->db->where(array('id_account'=>$id,'transaction_type'=>2,'transaction_from'=>1));
        return $this->db->get('transactions')->result_array();

    }

    public function prepare_credit_cashbook($id)
    {

        $account = $this->get_account($id);
        return $this->get_cashbook_credit_unchecked($id);

    }
   public function v_prepare_credit_cashbook($id)
    {

        $this->db->where(array('id_account'=>$id,'transaction_type'=>2,'transaction_from'=>2));
        return  $this->db->get('transactions')->result_array();

    }
    public function prepare_debit_cashbook($id)
    {

        $account = $this->get_account($id);
        return $this->get_cashbook_debit_unchecked($id);

    }
   public function v_prepare_debit_cashbook($id)
    {

        $this->db->where(array('id_account'=>$id,'transaction_type'=>1,'transaction_from'=>2));
        return $this->db->get('transactions')->result_array();

    }

    public function get_difference($debit,$credit)
    {
        //credit = +
        //debit = -
        $sum_credit = 0.00;
        $sum_debit = 0.00;
        foreach($debit as $amt)
        {
           $sum_debit += $amt['amount'];
        }
        foreach ($credit as $amt)
        {
            $sum_credit += $amt['amount'];
        }

        return $sum_credit - $sum_debit;
    }

    public function get_reconciliations($id,$company)
    {
        $this->db->where(array('id_account'=>$id,'id_company'=>$company));
        return $this->db->get('reconciliations')->result_array();
    }

    public function can_create_new_reconciliations($id,$company)
    {
       $recon = $this->get_reconciliations($id,$company);
        foreach($recon as $recons)
        {
            if($recons['opened'] == 1)
                return false;
        }
        return true;
    }
    public function new_recon($data)
    {
        $this->db->insert('reconciliations',$data);
        return $this->db->insert_id();
    }

    public function get_recon($id)
    {
        $this->db->where(array('id'=>$id));
        $res = $this->db->get('reconciliations')->result_array();
        if(sizeof($res) > 0)
            $res = $res[0];

        return $res;

    }


    public function mark_checked($keys,$data)
    {

        foreach($keys as $key)
        {
            $this->db->where(array('id'=>$key));
            $this->db->update('transactions',$data);
        }
    }

    public function set_closing_balance($id,$data)
    {
        $this->db->where(array('id'=>$id));
        $this->db->update('reconciliations',$data);

    }

    public function prepare_sys_admin_dashboard()
    {
        //number of companies
        $this->db->where(array('is_active'=>1));
        $num_companies = $this->db->get('companies')->num_rows();
        //number of users
        $this->db->where(array('user_role !='=>-5));
        $num_users = $this->db->get('users')->num_rows();

        //number od accounts
        $num_accounts = $this->db->get('accounts')->num_rows();

        return array('users'=>$num_users,'accounts'=>$num_accounts,'companies'=>$num_companies);
    }

    public function prepare_com_admin_dashboard($id_company)
    {

        //number of users
        $this->db->where(array('id_company'=>$id_company));
        $num_users = $this->db->get('users')->num_rows();
        //number of accounts
        $this->db->where(array('id_company'=>$id_company));
        $num_accounts = $this->db->get('accounts')->num_rows();

        //number of closed reconciliations
        $this->db->where(array('id_company'=>$id_company,'opened'=>0));
        $num_recon = $this->db->get('reconciliations')->num_rows();
        return array('users'=>$num_users,'accounts'=>$num_accounts,'closed reconciliations'=>$num_recon);
    }

    public function prepare_user_dashboard($id_user)
    {

        //number of accounts

        $this->db->where(array('id_user'=>$id_user));
        $num_accounts = $this->db->get('accounts')->num_rows();

        // number of closed reconciliations
        $this->db->where(array('id_user'=>$id_user,'opened'=>1));
        $num_recon_opened = $this->db->get('reconciliations')->num_rows();

        // number of opened reconciliations
        $this->db->where(array('id_user'=>$id_user,'opened'=>0));
        $num_recon_closed = $this->db->get('reconciliations')->num_rows();

        return array('opened reconciliations'=>$num_recon_opened,'accounts'=>$num_accounts,'closed reconciliations'=>$num_recon_closed);
    }

    public function check_new_reconciliation($id)
    {
        $this->db->where(array('id_account'=>$id));
        $rec = $this->db->get('reconciliations')->result_array();
        if(sizeof($rec) != 0)
            $rec = $rec[sizeof($rec)-1];

        return $rec;
    }

    public function check_restore_reconciliation($id)
    {
        $this->db->where(array('id_account'=>$id));
        $rec = $this->db->get('reconciliations')->result_array();
        if(sizeof($rec) != 0)
            $rec = $rec[sizeof($rec)-2];
        return $rec;
    }

    public function get_adjusted_cashbook($balance,$bank_credits,$cash_credits)

    {
        $cash_subtotal = 0; $bank_subtotal = 0;
        foreach($cash_credits as $cash_credit)
        {
            $cash_subtotal += $cash_credit['amount'];

        }
        foreach($bank_credits as $bank_credit)
        {
            $bank_subtotal += $bank_credit['amount'];

        }

        return $balance + $bank_subtotal  + $cash_subtotal;

    }
    public function get_adjusted_bank($balance,$bank_debits,$cash_debits)

    {
        $cash_subtotal = 0; $bank_subtotal = 0;
        foreach($cash_debits as $cash_debit)
        {
            $cash_subtotal += $cash_debit['amount'];

        }
        foreach($bank_debits as $bank_debit)
        {
            $bank_subtotal += $bank_debit['amount'];

        }

        return $balance + $bank_subtotal  + $cash_subtotal;


    }
    public function get_accounts_reconciliation($id)
    {
            return $this->db->get_where('reconciliations',array('id_account'=>$id))->result_array();

    }
    public function edit_comment($id,$comment)
    {
        $this->db->where(array('id'=>$id));
        $this->db->update('transactions',array('comment'=>$comment));
    }

    public function myTruncate2($string, $limit, $break=" ", $pad="...")
    {
        // return with no change if string is shorter than $limit
        if(strlen($string) <= $limit) return $string;
        $string = substr($string, 0, $limit);
        if(false !== ($breakpoint = strrpos($string, $break))) {
            $string = substr($string, 0, $breakpoint);
        }

        return $string . $pad;
    }


    public function logger($data)
    {
        $this->db->insert('logs',$data);
    }
    public function get_logs()
    {
        return $this->db->get('logs')->result_array();
    }

    public function get_last($id)
    {
        $this->db->select_max('id','id');
        $this->db->where(array('id_account'=>$id));
        return $this->db->get('transactions')->result_array();

    }

    public function take_out_checked($data,$id_recon,$max)
    {
        $final = array();
        foreach($data as $temp)
        {
            if($temp['id'] <= $max)
            {
                if($temp['is_checked'] == 0)
                {
                    $final[sizeof($final)] = $temp;
                }
                else
                {
                    if($id_recon < $temp['id_recon'])
                    {
                        $final[sizeof($final)] = $temp;
                    }
                }

            }

        }

        return $final;
    }
    function findFirstAndLastDay($anyDate)
    {
        //$anyDate            =    '2009-08-25';    // date format should be yyyy-mm-dd
        list($yr,$mn,$dt)    =    explode('-',$anyDate);    // separate year, month and date
        $timeStamp            =    mktime(0,0,0,$mn,1,$yr);    //Create time stamp of the first day from the give date.
        $firstDay            =     date('D',$timeStamp);    //get first day of the given month
        list($y,$m,$t)        =     explode('-',date('Y-m-t',$timeStamp)); //Find the last date of the month and separating it
        $lastDayTimeStamp    =    mktime(0,0,0,$m,$t,$y);//create time stamp of the last date of the give month
        $lastDay            =    date('D',$lastDayTimeStamp);// Find last day of the month
        $arrDay                =    array($firstDay,$lastDay); // return the result in an array format.

        return $arrDay;
    }

    function delete_transactions($id,$account)
    {
        $this->db->where(array('id >'=>$id,'id_account'=>$account));
        $this->db->delete('transactions');
    }


    function delete_recon($id)
    {

        $this->db->where(array('id'=>$id));
        $this->db->delete('reconciliations');

    }

    function reopen_recon($id)
    {
        $this->db->where(array('id'=>$id));
        $this->db->update('reconciliations',array('opened'=>1,'max_transaction'=>0));
    }

    public function check_can_back_up()
    {
        $this->db->where(array('date'=>date("Y-m-d")));
        $rest = $this->db->get('back_ups')->result_array();
        if(sizeof($rest) >0)
        {
            return false;
        }
        return true;
    }
    public function back_up($file_name)
    {
        $data  = array('file_name'=>$file_name,'date'=>date("Y-m-d"));
        $this->db->insert('back_ups',$data);
    }

}
