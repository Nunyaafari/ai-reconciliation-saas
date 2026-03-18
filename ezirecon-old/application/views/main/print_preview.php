<?php
/**
 * Created by PhpStorm.
 * User: root
 * Date: 4/28/15
 * Time: 6:02 PM
 */
$bank_statement_total = 0.00;
$cashbook_statement_total = 0.00;
$temp_expo = explode('/',$recon_data['month']);

?>
<div class="row">
    <div class="col-xs-12">
        <h3 class="box-title"> <?php echo strtoupper($company['name']); ?></h3>
    </div>
    <div class="col-xs-9">
        <h4 class="box-title"><?php echo strtoupper('Bank Reconciliation statement for'); ?> <?php echo strtoupper($account['account_name']); ?> <?php echo strtoupper("for the month of") ?> <?php echo  date('M, Y',strtotime($temp_expo[0].'/01/'.$temp_expo[1]));?></h4>
    </div>

</div>



<div class="row rentalListCan" id="rentalListCan">
    <div class="col-xs-6">
        <div class="box">
            <div class="box-header">
                <h3 class="box-title">BALANCE AS PER CASH BOOK : <span class=""> Ghc <?php echo number_format($recon_data['cashbook_closing_balance'],2,'.',','); $cashbook_statement_total = $recon_data['cashbook_closing_balance']; ?> </span></h3>
                <h5><?php echo strtoupper("Cash Book Credits") ?></h5>
<!--                <h5>Transaction Type : Credit / Transaction As Per : Cash Book</h5>-->
                <?php
                $sub = 0.00;
                ?>
            </div><!-- /.box-header -->
            <div class="box-body">
                <table style=" width: 100%; border-top: 1px solid #000; ">
                    <thead>
                    <tr class="around" style=" border-bottom: 1px solid #000;border-left: 1px solid #000;border-right: 1px solid #000; ">
                        <th class="around" style=" margin-outside: 5px; border-bottom: 1px solid #000; border-left: 1px solid #000;border-right: 1px solid #000; width: 20%">Date</th>
                        <th class="around" style=" width: 40%; margin-outside: 5px; border-bottom: 1px solid #000; border-left: 1px solid #000;border-right: 1px solid #000; ">Narration</th>
                        <th class="around" style=" width: 20%; margin-outside: 5px; border-bottom: 1px solid #000; border-left: 1px solid #000;border-right: 1px solid #000;">Amount</th>
                        <th class="around" style="width: 20%; margin-outside: 5px; border-bottom: 1px solid #000; border-left: 1px solid #000;border-right: 1px solid #000;">Comment</th>
                    </tr>
                    </thead>
                    <tbody>
                    <?php
                    foreach($ccredit as $transaction):
                        ?>
                        <tr class="around" id="cash_<?php echo $transaction['id']; ?>_credit">
                            <td class="around" style=" border-bottom: 1px solid #000;border-left: 1px solid #000;border-right: 1px solid #000; width: 20% "><font size="2"><?php echo date('d M, Y',strtotime($transaction['date'])) ?></font></td>
                            <td class="around" style=" border-bottom: 1px solid #000;border-left: 1px solid #000;border-right: 1px solid #000; width: 40%; " ><?php echo $this->site_model->myTruncate2( $transaction['narration'],25) ?></td>
                            <td class="around" style=" border-bottom: 1px solid #000;border-left: 1px solid #000;border-right: 1px solid #000; width: 20% "> <?php echo number_format($transaction['amount'],2,'.',','); $cashbook_statement_total += $transaction['amount']; $sub += $transaction['amount']  ?></td>
                            <td class="around" style=" border-bottom: 1px solid #000;border-left: 1px solid #000;border-right: 1px solid #000; width: 20% "> <?php if($transaction['comment'] != "No Comment Yet") echo $transaction['comment'];  ?></td>
                        </tr>

                    <?php
                    endforeach;
                    ?>
                    </tbody>
                    <tfoot>
                    </tfoot>
                </table>
            </div><!-- /.box-body -->
            <div class="box-body">
                <span>Sub - Total </span> Ghc <span id="sub_ccredit" class="alert-info"><?php echo number_format($sub,2,'.',','); $sub = 0.00; ?> </span>
            </div>
        </div><!-- /.box -->
    </div>
    <div class="col-xs-6">
        <div class="box">
            <div class="box-header">
                <h3 class="box-title">BALANCE AS PER BANK STATEMENT : <span class="">Ghc <?php echo number_format($recon_data['bank_closing_balance'],2,'.',','); $bank_statement_total = $recon_data['bank_closing_balance']; ?> </span></h3>
                <h5><?php echo strtoupper("Bank Statement Debits"); ?> </h5>
<!--                <h5>Transaction Type : Debit / Transaction As Per : Bank Statement</h5>-->
            </div><!-- /.box-header -->
            <div class="box-body">
                <table style=" width: 100%; border-bottom: 1px solid #000; ">
                    <thead style=" border-top: 1px solid #000; ">
                    <tr style=" border-bottom: 1px solid #000; border-left: 1px solid #000;border-right: 1px solid #000;">
                        <th class="around" style=" width: 20%; margin-outside: 5px; border-bottom: 1px solid #000; border-left: 1px solid #000;border-right: 1px solid #000;">Date</th>
                        <th class="around" style=" width: 40%; margin-outside: 5px; border-bottom: 1px solid #000; border-left: 1px solid #000;border-right: 1px solid #000;">Narration</th>
                        <th class="around" style="width: 20%; margin-outside: 5px; border-bottom: 1px solid #000; border-left: 1px solid #000;border-right: 1px solid #000;">Amount</th>
                        <th class="around" style="width: 20%; margin-outside: 5px; border-bottom: 1px solid #000; border-left: 1px solid #000;border-right: 1px solid #000;">Comment</th>
                    </tr>
                    </thead>
                    <tbody>
                    <?php
                    foreach($bdebit as $transaction):
                        ?>
                        <tr class="around" style=" border-bottom: 1px solid #000;border-left: 1px solid #000;border-right: 1px solid #000; " id="bank_<?php echo $transaction['id']; ?>_debit">
                            <td class="around" style=" border-bottom: 1px solid #000;border-left: 1px solid #000;border-right: 1px solid #000; width: 20% "><font size="2"><?php echo date('d M, Y',strtotime($transaction['date'])) ?></font></td>
                            <td class="around" style=" border-bottom: 1px solid #000;border-left: 1px solid #000;border-right: 1px solid #000; width: 40% "><?php echo $this->site_model->myTruncate2( $transaction['narration'],25) ?></td>
                            <td class="around" style=" border-bottom: 1px solid #000;border-left: 1px solid #000;border-right: 1px solid #000; width: 20% "> <?php echo number_format($transaction['amount'],2,'.',','); $bank_statement_total += $transaction['amount']; $sub += $transaction['amount']; ?></td>
                            <td class="around" style=" border-bottom: 1px solid #000;border-left: 1px solid #000;border-right: 1px solid #000; width: 20% "> <?php if($transaction['comment'] != "No Comment Yet") echo $transaction['comment'];  ?></td>

                        </tr>

                    <?php
                    endforeach;
                    ?>

                    </tbody>
                    <tfoot>

                    </tfoot>
                </table>
            </div><!-- /.box-body -->
            <div class="box-body">
                <span>Sub - Total </span> Ghc <span id="sub_bdebit" class="alert-info"><?php echo number_format($sub,2,'.',','); $sub = 0.00; ?> </span>
            </div>
        </div><!-- /.box -->
    </div><!-- /.col -->
</div>
<div class="row">
    <div class="col-xs-6">
        <div class="box">
            <div class="box-header">
                <h5><?php echo strtoupper("Cash Book Debits"); ?></h5>
<!--                <h5>Transaction Type : Debit / Transaction As Per : Cash Book</h5>-->
            </div><!-- /.box-header -->
            <div class="box-body">
                <table style=" width: 100%; border-bottom: 1px solid #000; ">
                    <thead>
                    <tr style=" border-top: 1px solid #000; border-left: 1px solid #000;border-right: 1px solid #000;">
                        <th class="around" style=" width: 20%; border-bottom: 1px solid #000; border-left: 1px solid #000;border-right: 1px solid #000;">Date</th>
                        <th class="around" style="width: 40%; border-bottom: 1px solid #000; border-left: 1px solid #000;border-right: 1px solid #000;">Narration</th>
                        <th class="around" style="width: 20%; border-bottom: 1px solid #000; border-left: 1px solid #000;border-right: 1px solid #000;">Amount</th>
                        <th class="around" style="width: 20%; border-bottom: 1px solid #000; border-left: 1px solid #000;border-right: 1px solid #000;">Comment</th>
                    </tr>
                    </thead>
                    <tbody>
                    <?php
                    foreach($cdebit as $transaction):
                        ?>
                        <tr class="around" style=" border-bottom: 1px solid #000;border-left: 1px solid #000;border-right: 1px solid #000; " id="cash_<?php echo $transaction['id']; ?>_debit">
                            <td class="around" style=" border-bottom: 1px solid #000;border-left: 1px solid #000;border-right: 1px solid #000; width: 20% "><font size="2"><?php echo date('d M, Y',strtotime($transaction['date'])) ?></font></td>
                            <td class="around" style=" border-bottom: 1px solid #000;border-left: 1px solid #000;border-right: 1px solid #000; width: 40% "><?php echo $this->site_model->myTruncate2( $transaction['narration'],25) ?></td>
                            <td class="around" style=" border-bottom: 1px solid #000;border-left: 1px solid #000;border-right: 1px solid #000; width: 20% "> <?php echo number_format($transaction['amount'],2,'.',','); $cashbook_statement_total += $transaction['amount']; $sub += $transaction['amount']; ?></td>
                            <td class="around" style=" border-bottom: 1px solid #000;border-left: 1px solid #000;border-right: 1px solid #000; width: 20% "> <?php if($transaction['comment'] != "No Comment Yet") echo $transaction['comment'];  ?></td>

                        </tr>

                    <?php
                    endforeach;
                    ?>
                    </tbody>
                    <tfoot>
                    </tfoot>
                </table>
            </div><!-- /.box-body -->
            <div class="box-body">
                <span>Sub - Total </span> Ghc <span id="sub_cdebit" class="alert-info"><?php echo number_format($sub,2,'.',','); $sub = 0.00; ?> </span>
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
<!--                <h5>Transaction Type : Credit / Transaction As Per : Bank Statement</h5>-->
                <h5></h5>
            </div><!-- /.box-header -->
            <div class="box-body">
                <table style=" width: 100%; border-bottom: 1px solid #000; ">
                    <thead style=" border-top: 1px solid #000;border-left: 1px solid #000;border-right: 1px solid #000;  ">
                    <tr style=" border-bottom: 1px solid #000;border-left: 1px solid #000;border-right: 1px solid #000;  ">
                        <th class="around" style=" border-bottom: 1px solid #000;border-left: 1px solid #000;border-right: 1px solid #000; width: 20% ">Date</th>
                        <th class="around" style=" width: 40%; border-bottom: 1px solid #000;border-left: 1px solid #000;border-right: 1px solid #000;  ">Narration</th>
                        <th class="around" style=" width: 20%; border-bottom: 1px solid #000;border-left: 1px solid #000;border-right: 1px solid #000;  ">Amount</th>
                        <th class="around" style="width: 20%; border-bottom: 1px solid #000;border-left: 1px solid #000;border-right: 1px solid #000;  ">Comment</th>
                    </tr>
                    </thead>
                    <tbody>
                    <?php
                    foreach($bcredit as $transaction):
                        ?>
                        <tr class="around" style=" border-bottom: 1px solid #000;border-left: 1px solid #000;border-right: 1px solid #000; " id="bank_<?php echo $transaction['id']; ?>_credit">

                            <td class="around" style=" border-bottom: 1px solid #000;border-left: 1px solid #000;border-right: 1px solid #000; width: 20% "><font size="2"><?php echo date('d M, Y',strtotime($transaction['date'])) ?></font></td>
                            <td class="around" style=" border-bottom: 1px solid #000;border-left: 1px solid #000;border-right: 1px solid #000; width: 40%  "><?php echo $this->site_model->myTruncate2( $transaction['narration'],25) ?></td>
                            <td class="around" style=" border-bottom: 1px solid #000;border-left: 1px solid #000;border-right: 1px solid #000; width: 20%  "> <?php echo number_format($transaction['amount'],2,'.',','); $bank_statement_total += $transaction['amount']; $sub += $transaction['amount']; ?></td>
                            <td class="around" style=" margin-outside: 5px; border-bottom: 1px solid #000; border-left: 1px solid #000;border-right: 1px solid #000; width: 20% "> <?php if($transaction['comment'] != "No Comment Yet") echo $transaction['comment'];  ?></td>
                        </tr>

                    <?php
                    endforeach;
                    ?>
                    </tbody>
                    <tfoot>
                    </tfoot>
                </table>
            </div><!-- /.box-body -->
            <div class="box-body">
                <span>Sub - Total </span> Ghc <span id="sub_bcredit" class="alert-info"><?php echo number_format($sub,2,'.',','); $sub = 0.00; ?> </span>
            </div>
            <div class="box-header">
                <h5 id="bank_total"> Adjusted Balance : Ghc <span id="b_total"><?php echo number_format(floatval($adjusted_bank),2,'.',','); ?></span> </h5>
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
    <div class="col-xs-4 noprint">
        <a href="javascript:window.print()" class="btn btn-success">Print</a>
        <?php if(isset($_GET['closed_recon']) && $_GET['closed_recon'] == 1): ?>
            <a href="<?php echo base_url(); ?>site/export_excel/<?php echo $this->uri->segment(2); ?>?closed_recon=1" class="btn btn-success"><i class="fa fa-disk"></i>Export To Excel</a>
        <?php else: ?>
            <a href="<?php echo base_url(); ?>site/export_excel/<?php echo $this->uri->segment(2); ?>" class="btn btn-success"><i class="fa fa-disk"></i>Export To Excel</a>
        <?php endif; ?>

    </div>
</div>
<div class="row">
    <div class="col-xs-4">
        <h5>
            Prepared By :
        </h5>
        <p>
            Name : _______________________________
            <br>
            <br>
            Signature : __________________________
        </p>
    </div>
    <div class="col-xs-4">
        <h5>
            Approved By :
        </h5>

        <p>
            Name : ___________________________________
            <br>
            <br>
            Signature : ______________________________
        </p>
    </div>
</div>
<div class="row">
<!--    <div class="ajax_message" id="ajax_message">-->
<!---->
<!--    </div>-->

</div>

