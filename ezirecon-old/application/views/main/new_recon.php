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
                <h3 class="box-title">New Monthly Reconciliation</h3>
            </div><!-- /.box-header -->
            <!-- form start -->
            <div class="ajax_message" id="ajax_message">

            </div>
            <form role="form" id="new_recon" class="new_recon">
                <div class="box-body">
                    <div class="form-group">
                        <label for="exampleInputEmail1">Month :</label>
                        <div class="input-group">
                            <div class="input-group-addon">
                                <i class="fa fa-calendar"></i>
                            </div>
                            <?php
                            if(sizeof($opening_balance) != 0):
                                $temp_expo = explode('/',$opening_balance['month']);
                                $d = new DateTime($temp_expo[1].'-'.$temp_expo[0].'-27');
                                $d->add(new DateInterval('P10D'));

                                ?>
                            <input type="text" class="form-control" name="month" id="datemask"  data-inputmask="'alias': 'mm/yyyy'" data-mask value="<?php echo $d->format('m/Y') ?>">
                            <?php
                            else:
                                $temp_expo = explode('/',$account['date']);
                                $d = new DateTime($temp_expo[1].'-'.$temp_expo[0].'-27');
                                $d->add(new DateInterval('P10D'));

                            ?>
                            <input type="text" class="form-control" name="month" id="datemask"  data-inputmask="'alias': 'mm/yyyy'" data-mask value="<?php echo $d->format('m/Y') ?>">
                            <?php
                            endif;
                            ?>
                        </div>
                        <input type="hidden" class="form-control" name="id_account" id="id_account" placeholder="Enter account name" value="<?php echo $account['id']; ?>">
                    </div>
                    <?php
                    if(sizeof($opening_balance) != 0):
                    ?>
                        <input type="hidden" class="form-control"  name="bank_opening" id="exampleInputPassword1" placeholder="Enter Bank Statement Opening Balance" <?php echo 'value = "'.$opening_balance["bank_closing_balance"].'"'; ?>>
                        <input type="hidden" class="form-control" name="cash_opening" id="exampleInputPassword1" placeholder="Enter Cash Book Opening Balance" <?php echo 'value = "'.$opening_balance["cashbook_closing_balance"].'"'; ?>>
                    <?php
                    else:
                    ?>
                            <input type="hidden" class="form-control"  name="bank_opening" id="exampleInputPassword1" value="<?php echo $account['bank_closing_balance']; ?>">
                            <input type="hidden" class="form-control" name="cash_opening" id="exampleInputPassword1" value="<?php echo $account['cashbook_closing_balance']; ?> >
                    <?php
                    endif;
                    ?>
                </div><!-- /.box-body -->

                <div class="box-footer">
                    <button type="submit" class="btn btn-primary">Submit</button>
                </div>
            </form>
        </div><!-- /.box -->
    </div>
</div>