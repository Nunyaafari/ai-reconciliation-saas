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
                <h3 class="box-title">CLOSING CASH BOOK BALANCE: <span class="alert-danger"><?php echo number_format($recon_data['cashbook_closing_balance'],2,'.',','); $cashbook_statement_total = $recon_data['cashbook_closing_balance']; ?> Ghc</span></h3>
                <h5>Transaction Type : Credit / Transaction As Per : Cash Book</h5>
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
                    </tr>
                    </thead>
                    <tbody>
                    <?php
                    foreach($ccredit as $transaction):
                        ?>
                        <tr id="cash_<?php echo $transaction['id']; ?>_credit">
                            <td><?php echo date('d M, Y',strtotime($transaction['date'])) ?></td>
                            <td><?php echo $transaction['ref']; ?></td>
                            <td><?php echo $transaction['narration'] ?></td>
                            <td> <?php echo number_format($transaction['amount'],2,'.',','); $cashbook_statement_total += $transaction['amount']; $sub += $transaction['amount']  ?></td>

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
                    </tr>
                    </tfoot>
                </table>
            </div><!-- /.box-body -->
            <div class="box-body">
                <span>Sub - Total </span> <span id="sub_ccredit" class="alert-info"><?php echo number_format($sub,2,'.',',');$cashbook_credit_sub_total = $sub; $sub = 0.00; ?> </span> Ghc
            </div>
<!--            <div class="box-body">-->
<!--                <a type="button" class="btn btn-info" onclick="add_transaction(2,2);">Add Transaction</a>-->
<!--            </div>-->
        </div><!-- /.box -->
    </div>
    <div class="col-xs-6">
        <div class="box">
            <div class="box-header">
                <h3 class="box-title">CLOSING BANK STATEMENT BALANCE: <span class="alert-danger"><?php echo number_format($recon_data['bank_closing_balance'],2,'.',','); $bank_statement_total = $recon_data['bank_closing_balance']; ?> Ghc</span></h3>
                <h5>Transaction Type : Debit / Transaction As Per : Bank Statement</h5>
            </div><!-- /.box-header -->
            <div class="box-body">
                <table id="example2" class="table table-bordered table-striped">
                    <thead>
                    <tr>
                        <th>Date</th>
                        <th>Ref</th>
                        <th>Narration</th>
                        <th>Amount</th>
                    </tr>
                    </thead>
                    <tbody>
                    <?php
                    foreach($bdebit as $transaction):
                        ?>
                        <tr id="bank_<?php echo $transaction['id']; ?>_debit">
                            <td><?php echo date('d M, Y',strtotime($transaction['date'])) ?></td>
                            <td><?php echo $transaction['ref']; ?></td>
                            <td><?php echo $transaction['narration'] ?></td>
                            <td> <?php echo number_format($transaction['amount'],2,'.',','); $bank_statement_total += $transaction['amount']; $sub += $transaction['amount']; ?></td>

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
                    </tr>
                    </tfoot>
                </table>
            </div><!-- /.box-body -->
            <div class="box-body">
                <span>Sub - Total </span> <span id="sub_bdebit" class="alert-info"><?php echo number_format($sub,2,'.',',');$bank_statement_debit_sub_total = $sub; $sub = 0.00; ?> </span> Ghc
            </div>
<!--            <div class="box-body">-->
<!--                <a type="button" class="btn btn-info" onclick="add_transaction(1,1);">Add Transaction</a>-->
<!--            </div>-->
        </div><!-- /.box -->
    </div><!-- /.col -->
</div>
<div class="row">
    <div class="col-xs-6">
        <div class="box">
            <div class="box-header">
                <h5>Transaction Type : Debit / Transaction As Per : Cash Book</h5>
            </div><!-- /.box-header -->
            <div class="box-body">
                <table id="example3" class="table table-bordered table-striped">
                    <thead>
                    <tr>
                        <th>Date</th>
                        <th>Ref</th>
                        <th>Narration</th>
                        <th>Amount</th>
                    </tr>
                    </thead>
                    <tbody>
                    <?php
                    foreach($cdebit as $transaction):
                        ?>
                        <tr id="cash_<?php echo $transaction['id']; ?>_debit">
                            <td><?php echo date('d M, Y',strtotime($transaction['date'])) ?></td>
                            <td><?php echo $transaction['ref']; ?></td>
                            <td><?php echo $transaction['narration'] ?></td>
                            <td> <?php echo number_format($transaction['amount'],2,'.',','); $cashbook_statement_total += $transaction['amount']; $sub += $transaction['amount']; ?></td>

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
                    </tr>
                    </tfoot>
                </table>
            </div><!-- /.box-body -->
            <div class="box-body">
                <span>Sub - Total </span> <span id="sub_cdebit" class="alert-info"><?php echo number_format($sub,2,'.',',');$cashbook_debit_sub_total = $sub; $sub = 0.00; ?> </span> Ghc
            </div>
<!--            <div class="box-body">-->
<!--                <a type="button" class="btn btn-info" onclick="add_transaction(1,2);">Add Transaction</a>-->
<!--            </div>-->
            <div class="box-header">
                <h5 id="cashbook_total"> Adjusted Cash Book Balance : <span id="c_total"><?php echo number_format(floatval($adjusted_cash),2,'.',','); ?></span> Ghc </h5>
            </div><!-- /.box-header -->
        </div><!-- /.box -->
    </div>
    <div class="col-xs-6">
        <div class="box">
            <div class="box-header">
                <h5>Transaction Type : Credit / Transaction As Per : Bank Statement</h5>
                <h5></h5>
            </div><!-- /.box-header -->
            <div class="box-body">
                <table id="example4" class="table table-bordered table-striped">
                    <thead>
                    <tr>
                        <th>Date</th>
                        <th>Ref</th>
                        <th>Narration</th>
                        <th>Amount</th>
                    </tr>
                    </thead>
                    <tbody>
                    <?php
                    foreach($bcredit as $transaction):
                        ?>
                        <tr id="bank_<?php echo $transaction['id']; ?>_credit">

                            <td><?php echo date('d M, Y',strtotime($transaction['date'])) ?></td>
                            <td><?php echo $transaction['ref']; ?></td>
                            <td><?php echo $transaction['narration'] ?></td>
                            <td> <?php echo number_format($transaction['amount'],2,'.',','); $bank_statement_total += $transaction['amount']; $sub += $transaction['amount']; ?></td>
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
                    </tr>
                    </tfoot>
                </table>
            </div><!-- /.box-body -->
            <div class="box-body">
                <span>Sub - Total </span> <span id="sub_bcredit" class="alert-info"><?php echo number_format($sub,2,'.',',');$bank_statement_credit_sub_total = $sub; $sub = 0.00; ?> </span> Ghc
            </div>
<!--            <div class="box-body">-->
<!--                <a type="button" class="btn btn-info" onclick="add_transaction(2,1);">Add Transaction</a>-->
<!--            </div>-->
            <div class="box-header">
                <h5 id="bank_total"> Adjusted Bank Statement Balance : <span id="b_total"><?php echo number_format(floatval($adjusted_bank),2,'.',','); ?></span> Ghc </h5>
            </div><!-- /.box-header -->
        </div><!-- /.box -->
    </div><!-- /.col -->
</div>
<div class="row">
    <div class="col-xs-12">
        <span id="check">
            <?php
            $diff = $adjusted_cash - $adjusted_bank;
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

</div>
<div class="row">
    <div class="ajax_message" id="ajax_message">

    </div>
    <div class="col-xs-6">
        <a type="button" class="btn btn-info" href="<?php echo base_url() ?>print_preview/<?php echo $this->uri->segment(2); ?>?closed_recon=1">Print Preview</a>
        <?php
        if($this->session->saved_keys != NULL)
        {
            ?>

        <?php
        }
        ?>
    </div>
</div>



