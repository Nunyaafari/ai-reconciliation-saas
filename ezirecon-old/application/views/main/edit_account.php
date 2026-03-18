<?php
/**
 * Created by PhpStorm.
 * User: root
 * Date: 4/23/15
 * Time: 10:47 AM
 */
?>
<div class="row">
    <!-- left column -->
    <div class="col-md-12">
        <!-- general form elements -->
        <div class="box box-primary">
            <div class="box-header">
                <h3 class="box-title">Edit Account Details</h3>
            </div><!-- /.box-header -->
            <!-- form start -->
            <div class="ajax_message" id="ajax_message">

            </div>
            <form role="form" id="edit_account" class="edit_account">
                <div class="box-body">
                    <div class="form-group">
                        <label for="exampleInputEmail1">Account Name</label>
                        <input type="text" class="form-control" name="account_name" id="exampleInputEmail1" placeholder="Enter account name" value="<?php echo $account['account_name'] ?>">
                    </div>
                    <div class="form-group">
                        <label for="exampleInputPassword1">Account Number</label>
                        <input type="text" class="form-control" name="account_number" id="exampleInputPassword1" placeholder="Enter account number" value="<?php echo $account['account_number'] ?>">
                    </div>
                    <div class="form-group">
                        <label for="exampleInputPassword1">Bank Account</label>
                        <input type="text" class="form-control" name="bank_accounts" id="exampleInputPassword1" placeholder="Enter bank account" value="<?php echo $account['bank_accounts'] ?>">
                    </div>
                    <div class="form-group">
                        <label for="exampleInputPassword1">Branch</label>
                        <input type="text" class="form-control" name="branch" id="exampleInputPassword1" placeholder="Enter branch" value="<?php echo $account['branch'] ?>">
                        <input type="hidden" class="form-control" name="id_company" id="exampleInputPassword1" placeholder="Enter branch" value="<?php echo $user_sess['id_company']; ?>">
                        <input type="hidden" class="form-control" name="id" id="exampleInputPassword1" placeholder="Enter branch" value="<?php echo $account['id']; ?>">
                    </div>
                    <div class="form-group">
                        <label for="exampleInputPassword1">Account User</label>
                        <select name="id_user" class="form-control">
                            <?php
                            foreach($company_users as $company_user):
                                ?>
                                <option value="<?php echo $company_user['id']; ?>" <?php if($account['id_user'] == $company_user['id']) echo 'selected'; ?>>
                                    <?php echo $company_user['fullname']; ?>
                                </option>
                            <?php
                            endforeach;
                            ?>
                        </select>
                    </div>
                </div><!-- /.box-body -->

                <div class="box-footer">
                    <button type="submit" class="btn btn-primary">Submit</button>
                </div>
            </form>
        </div><!-- /.box -->
    </div>
</div>