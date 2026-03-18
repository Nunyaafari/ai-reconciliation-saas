<?php
/**
 * Created by PhpStorm.
 * User: root
 * Date: 4/23/15
 * Time: 2:29 PM
 */
?>
<div class="row">
    <div class="col-xs-12">
        <div class="box">
            <?php
                if($user_sess['user_role'] != 1):
            ?>
            <div class="box-header">
                <h3 class="box-title"><a href="<?php echo base_url(); ?>new_account"><button class="btn btn-block btn-primary btn-sm">Add Account</button></a></h3>
            </div>
            <?php
            endif;
            ?>

            <div class="box-body">
                <table id="example1" class="table table-bordered table-striped">
                    <thead>
                    <tr>
                        <th>Account Name</th>
                        <th>Account Number</th>
                        <th>Branch</th>
                        <th>Bank Accounts</th>
                        <th>User Full Name</th>
                        <th>Actions</th>
                    </tr>
                    </thead>
                    <tbody>
                    <?php
                        foreach($accounts as $account):
                    ?>
                    <tr>
                        <td><?php echo $account['account_name']; ?></td>
                        <td><?php echo $account['account_number']; ?></td>
                        <td> <?php echo $account['branch']; ?></td>
                        <td> <?php echo $account['bank_accounts'] ?></td>
                        <td> <?php echo $account['user_name'] ?></td>
                        <td>
                            <div class="btn-group">
                                <button type="button" class="btn btn-info">Action</button>
                                <button type="button" class="btn btn-info dropdown-toggle" data-toggle="dropdown">
                                    <span class="caret"></span>
                                </button>
                                <ul class="dropdown-menu" role="menu">
                                    <?php
                                        if($user_sess['user_role'] == 0 || $user_sess['user_role'] == -5) {
                                            ?>
                                            <li>
                                                <a href="<?php echo base_url(); ?>edit_account/<?php echo $account['id']; ?>">Edit</a>
                                            </li>
                                            <li>
                                                <a href="#" onclick="delete_account(<?php echo $account['id']; ?>)">Delete</a>
                                            </li>
                                        <?php
                                        }
                                        if($account['setup'] && $account['bank_closing_balance'] == 0 && $account['cashbook_closing_balance'] == 0):
                                            ?>
                                            <li><a href="<?php echo base_url(); ?>set_up/<?php echo $account['id']; ?>">Setup Account</a></li>
                                            <?php
                                    else:
                                            if(sizeof($this->site_model->check_new_reconciliation($account['id'])) != 0):
                                    ?>
                                    <li><a href="<?php echo base_url(); ?>add_transaction/<?php echo $account['id']; ?>">Add Transactions</a></li>
                                    <li><a href="<?php echo base_url(); ?>upload_excel/<?php echo $account['id']; ?>">Upload Excel File</a></li>
                                                <?php
                                                    endif;
                                                ?>
                                    <li><a href="<?php echo base_url(); ?>reconciliations/<?php echo $account['id']; ?>">Reconciliation</a></li>
                                    <?php
                                    endif;
                                    ?>
                                </ul>
                            </div>
                        </td>
                    </tr>
                    <?php
                    endforeach;
                    ?>

                    </tbody>
                    <tfoot>
                    <tr>
                        <th>Account Name</th>
                        <th>Account Number</th>
                        <th>Branch</th>
                        <th>Bank Accounts</th>
                        <th>User Full Name</th>
                        <th>Actions</th>
                    </tr>
                    </tfoot>
                </table>
            </div><!-- /.box-body -->
        </div><!-- /.box -->
    </div><!-- /.col -->
</div><!-- /.row -->