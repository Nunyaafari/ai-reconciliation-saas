<?php
/**
 * Created by PhpStorm.
 * User: root
 * Date: 4/28/15
 * Time: 6:02 PM
 */
$bank_statement_total = 0.00;
$cashbook_statement_total = 0.00;
$cashbook_credit_sub_total = 0.00;
$cashbook_debit_sub_total = 0.00;
$bank_statement_credit_sub_total = 0.00;
$bank_statement_debit_sub_total = 0.00;
$temp_expo = explode('/',$recon_data['month']);
?>
<div class="row">
    <div class="col-xs-9">
        <h3 class="box-title" style="color: red;">Bank Reconciliation statement for <?php echo $account['account_name']; ?> for the month of <?php echo date('M, Y',strtotime($temp_expo[0].'/01/'.$temp_expo[1]));?></h3>
    </div>

</div>



<div class="row">
    <div class="col-xs-6">
        <div class="box">
            <div class="box-header">
                <h3 class="box-title">CLOSING CASH BOOK BALANCE: <span style="color: red"> Ghc<?php echo number_format($recon_data['cashbook_closing_balance'],2,'.',','); $cashbook_statement_total = $recon_data['cashbook_closing_balance']; ?> </span></h3>
                <h5><?php echo strtoupper("Cash Book Credits") ?></h5>
                <?php
                    $sub = 0.00;
                ?>
            </div><!-- /.box-header -->
            <div class="box-body">
                <table id="example1" class="table table-bordered table-striped">
                    <thead>
                    <tr>
                        <th>Date</th>
                        <th>Ref</th>
                        <th>Narration</th>
                        <th>Amount</th>
                        <th>Actions</th>
                    </tr>
                    </thead>
                    <tbody>
                    <?php
                    foreach($ccredit as $transaction):
                        ?>
                        <tr id="cash_<?php echo $transaction['id']; ?>_credit" data-toggle="tooltip" title="<?php echo $transaction['comment'] ?>">
                        <td><?php echo date('d M, Y',strtotime($transaction['date'])) ?></td>
                            <td><?php echo $transaction['ref']; ?></td>
                            <td><?php echo $transaction['narration'] ?></td>
                            <td > <?php echo number_format($transaction['amount'],2,'.',','); $cashbook_statement_total += $transaction['amount']; $sub += $transaction['amount']  ?></td>
                            <td>
                            <span class="form-group">
                            <input type="checkbox" class="flat-red" onchange="edit_cash(<?php echo $transaction['id'] ?>,<?php echo number_format($transaction['amount'],2,'.',',') ?>);"/>
                                <button class="btn btn-info" title="Add Comment" onclick="new_comment('<?php echo preg_replace('/(\'|&#0*39;)/', '', $transaction['comment']) ?>',<?php echo $transaction['id'] ?>)"><i class="fa fa-comments-o"></i></button>
                            </span>
                            </td>
                        </tr>

                    <?php
                    endforeach;
                    ?>
                    </tbody>
                    <tfoot>
                    <tr>
                        <th>Date</th>
                        <th>Ref</th>
                        <th>Narration</th>
                        <th>Amount</th>
                        <th>Actions</th>
                    </tr>
                    </tfoot>
                </table>
            </div><!-- /.box-body -->
            <div class="box-body">
                <span>Sub - Total </span> Ghc <span id="sub_ccredit" class="alert-info"><?php echo number_format($sub,2,'.',',');$cashbook_credit_sub_total = $sub; $sub = 0.00; ?> </span>
            </div>
            <div class="box-body">
                <?php
                if($account['id_user'] == $user_sess['id']):
                ?>
                <a type="button" class="btn btn-info" onclick="add_transaction(2,2);">Add Transaction</a>
                <?php
                endif;
                ?>
<!--                <a type="button" class="btn btn-info" onclick="upload_transaction(2,2);">Upload Transaction</a>-->
            </div>
        </div><!-- /.box -->
    </div>
    <div class="col-xs-6">
        <div class="box">
            <div class="box-header">
                <h3 class="box-title">CLOSING BANK STATEMENT BALANCE: Ghc <span style="color: red"><?php echo number_format($recon_data['bank_closing_balance'],2,'.',','); $bank_statement_total = $recon_data['bank_closing_balance']; ?> </span></h3>
                <h5><?php echo strtoupper("Bank Statement Debits"); ?></h5>
            </div><!-- /.box-header -->
            <div class="box-body">
                <table id="example2" class="table table-bordered table-striped">
                    <thead>
                    <tr>
                        <th>Date</th>
                        <th>Ref</th>
                        <th>Narration</th>
                        <th>Amount</th>
                        <th>Actions</th>
                    </tr>
                    </thead>
                    <tbody>
                    <?php
                        foreach($bdebit as $transaction):
                            ?>
                            <tr id="bank_<?php echo $transaction['id']; ?>_debit" data-toggle="tooltip" title="<?php echo $transaction['comment'] ?>">
                                <td><?php echo date('d M, Y',strtotime($transaction['date'])) ?></td>
                                <td><?php echo $transaction['ref']; ?></td>
                                <td><?php echo $transaction['narration'] ?></td>
                                <td > <?php echo number_format($transaction['amount'],2,'.',','); $bank_statement_total += $transaction['amount']; $sub += $transaction['amount']; ?></td>
                                <td>
                            <span class="form-group" >
                                <input type="checkbox" class="flat-red"/>
                                <button class="btn btn-info" title="Add Comment"  onclick="new_comment('<?php echo preg_replace('/(\'|&#0*39;)/', '', $transaction['comment']) ?>',<?php echo $transaction['id'] ?>)"><i class="fa fa-comments-o"></i></button>

                            </span>
                                </td>
                            </tr>

                        <?php
                    endforeach;
                    ?>

                    </tbody>
                    <tfoot>
                    <tr>
                        <th>Date</th>
                        <th>Ref</th>
                        <th>Narration</th>
                        <th>Amount</th>
                        <th>Actions</th>
                    </tr>
                    </tfoot>
                </table>
            </div><!-- /.box-body -->
            <div class="box-body">
                <span>Sub - Total </span> Ghc <span id="sub_bdebit" class="alert-info"><?php echo number_format($sub,2,'.',',');$bank_statement_debit_sub_total = $sub; $sub = 0.00; ?> </span>
            </div>
            <div class="box-body">
                <?php
                if($account['id_user'] == $user_sess['id']):

                ?>
                <a type="button" class="btn btn-info" onclick="add_transaction(1,1);">Add Transaction</a>
                <?php
                    endif;
                ?>
<!--                <a type="button" class="btn btn-info" onclick="upload_transaction(1,1);">Upload Transaction</a>-->
            </div>
        </div><!-- /.box -->
    </div><!-- /.col -->
</div>
<div class="row">
    <div class="col-xs-6">
        <div class="box">
            <div class="box-header">
                <h5><?php echo strtoupper("Cash Book Debits"); ?></h5>
            </div><!-- /.box-header -->
            <div class="box-body">
                <table id="example3" class="table table-bordered table-striped">
                    <thead>
                    <tr>
                        <th>Date</th>
                        <th>Ref</th>
                        <th>Narration</th>
                        <th>Amount</th>
                        <th>Actions</th>
                    </tr>
                    </thead>
                    <tbody>
                    <?php
                    foreach($cdebit as $transaction):
                        ?>
                        <tr id="cash_<?php echo $transaction['id']; ?>_debit" data-toggle="tooltip" title="<?php echo $transaction['comment'] ?>">
                            <td><?php echo date('d M, Y',strtotime($transaction['date'])) ?></td>
                            <td><?php echo $transaction['ref']; ?></td>
                            <td><?php echo $transaction['narration'] ?></td>
                            <td> <?php echo number_format($transaction['amount'],2,'.',','); $cashbook_statement_total += $transaction['amount']; $sub += $transaction['amount']; ?></td>
                            <td>
                            <span class="form-group">
                            <input type="checkbox" class="flat-red" onchange="edit_cash(<?php echo $transaction['id']; ?>, <?php echo $transaction['amount'] ?>);"/>
                                <button class="btn btn-info" title="Add Comment"  onclick="new_comment('<?php echo preg_replace('/(\'|&#0*39;)/', '', $transaction['comment']) ?>',<?php echo $transaction['id'] ?>)"><i class="fa fa-comments-o"></i></button>
                            </span>
                            </td>
                        </tr>

                    <?php
                    endforeach;
                    ?>
                    </tbody>
                    <tfoot>
                    <tr>
                        <th>Date</th>
                        <th>Ref</th>
                        <th>Narration</th>
                        <th>Amount</th>
                        <th>Actions</th>
                    </tr>
                    </tfoot>
                </table>
            </div><!-- /.box-body -->
            <div class="box-body">
                <span>Sub - Total </span> Ghc <span id="sub_cdebit" class="alert-info"><?php echo number_format($sub,2,'.',',');$cashbook_debit_sub_total = $sub; $sub = 0.00; ?> </span>
            </div>
            <div class="box-body">
                <?php
                if($account['id_user'] == $user_sess['id']):

                ?>
                <a type="button" class="btn btn-info" onclick="add_transaction(1,2);">Add Transaction</a>
                <?php
                endif;
                ?>
<!--                <a type="button" class="btn btn-info" onclick="upload_transaction(1,2);">Upload Transaction</a>-->
            </div>
            <div class="box-header">
                <h5 id="cashbook_total"> Adjusted Balance : Ghc <span id="c_total"><?php echo number_format(floatval($adjusted_cash),2,'.',','); ?></span> </h5>
            </div><!-- /.box-header -->
        </div><!-- /.box -->
    </div>
    <div class="col-xs-6">
        <div class="box">
            <div class="box-header">
                <h5><?php echo strtoupper("Bank Statement Credits") ?></h5>
            </div><!-- /.box-header -->
            <div class="box-body">
                <table id="example4" class="table table-bordered table-striped">
                    <thead>
                    <tr>
                        <th>Date</th>
                        <th>Ref</th>
                        <th>Narration</th>
                        <th>Amount</th>
                        <th>Actions</th>
                    </tr>
                    </thead>
                    <tbody>
                    <?php
                    foreach($bcredit as $transaction):
                        ?>
                        <tr id="bank_<?php echo $transaction['id']; ?>_credit" data-toggle="tooltip" title="<?php echo $transaction['comment'] ?>">

                        <td><?php echo date('d M, Y',strtotime($transaction['date'])) ?></td>
                            <td><?php echo $transaction['ref']; ?></td>
                            <td><?php echo $transaction['narration'] ?></td>
                            <td > <?php echo number_format($transaction['amount'],2,'.',','); $bank_statement_total += $transaction['amount']; $sub += $transaction['amount']; ?></td>
                            <td>
                            <span class="form-group">
                            <input type="checkbox" class="flat-red" onchange="edit_bank(<?php echo $transaction['id'] ?>,<?php echo $transaction['amount'] ?>);"/>
                                <button class="btn btn-info" title="Add Comment"  onclick="new_comment('<?php echo preg_replace('/(\'|&#0*39;)/', '', $transaction['comment']) ?>',<?php echo $transaction['id'] ?>)"><i class="fa fa-comments-o"></i></button>
                            </span>
                            </td>
                        </tr>

                    <?php
                    endforeach;
                    ?>
                    </tbody>
                    <tfoot>
                    <tr>
                        <th>Date</th>
                        <th>Ref</th>
                        <th>Narration</th>
                        <th>Amount</th>
                        <th>Actions</th>
                    </tr>
                    </tfoot>
                </table>
            </div><!-- /.box-body -->
            <div class="box-body">
                <span>Sub - Total </span> Ghc <span id="sub_bcredit" class="alert-info"><?php echo number_format($sub,2,'.',',');$bank_statement_credit_sub_total = $sub; $sub = 0.00; ?> </span>
            </div>
            <div class="box-body">
                <?php
                if($account['id_user'] == $user_sess['id']):

                ?>
                <a type="button" class="btn btn-info" onclick="add_transaction(2,1);">Add Transaction</a>
                <?php
                endif;
                ?>
<!--                <a type="button" class="btn btn-info" onclick="upload_transaction(2,1);">Upload Transaction</a>-->
            </div>
            <div class="box-header">
                <h5 id="bank_total"> Adjusted Balance : Ghc <span id="b_total"><?php echo number_format(floatval($adjusted_bank),2,'.',','); ?></span> </h5>
            </div><!-- /.box-header -->
        </div><!-- /.box -->
    </div><!-- /.col -->
</div>
    <div style="position: fixed; top: 80%; left: 50%;">
        <span id="check">
            <?php
                $diff = round(floatval($adjusted_cash),2) - round(floatval($adjusted_bank),2);
            if(number_format($diff,2,'.',',') != 0.00):
            ?>
            <div class="box alert-danger" >
                Difference : <?php echo number_format($diff,2,'.',','); ?>
            </div>
            <?php
                else:
            ?>
                    <div class="box alert-success" >
                        Difference : <?php echo number_format($diff,2,'.',','); ?>
                    </div>
            <?php
            endif;
            ?>

            </span>
        </div>

<div class="row">
    <div class="ajax_message" id="ajax_message">

    </div>
    <div class="col-xs-6">
        <?php
            if($user_sess['user_role'] == 0):
        ?>
        <a type="button" class="btn btn-danger" onclick="close_recon();">Close Reconciliation</a>
        <?php
            endif;
        ?>
        <a type="button" class="btn btn-info" href="<?php echo base_url() ?>print_preview/<?php echo $this->uri->segment(2); ?>">Print Preview</a>
        <?php
        if($account['id_user'] == $user_sess['id']):
        ?>
        <a type="button" class="btn btn-success" onclick="to_save();">Remove And Save</a>
        <?php
            endif;
        ?>
        <?php
        if($this->session->saved_keys != NULL && $account['id_user'] == $user_sess['id']) {
            ?>

                <a type="button" class="btn btn-success" onclick="undo_save();">Undo Save</a>
        <?php
        }
        ?>
    </div>
</div>



