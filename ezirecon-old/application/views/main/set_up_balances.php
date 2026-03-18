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
                <h3 class="box-title">Account Setup</h3>
            </div><!-- /.box-header -->
            <!-- form start -->
            <div class="ajax_message" id="ajax_message">

            </div>
            <form role="form" id="setup_balance" class="setup_balance">
                <div class="box-body">
                    <div class="form-group">
                        <label for="exampleInputEmail1">Month :</label>
                        <div class="input-group">
                            <div class="input-group-addon">
                                <i class="fa fa-calendar"></i>
                            </div>
                            <input type="text" class="form-control" name="month" id="datemask"  data-inputmask="'alias': 'mm/yyyy'" data-mask>
                        </div>
                    </div>

                        <div class="form-group">
                            <label for="exampleInputPassword1">Bank Statement Closing Balance</label>
                            <div class="input-group">

                                <input type="text" class="form-control"  name="bank_closing" id="exampleInputPassword1" placeholder="Enter Bank Statement Closing Balance">
                                <div class="input-group-addon">
                                    <i>Ghc</i>
                                </div>
                            </div>
                        </div>
                        <div class="form-group">
                            <label for="exampleInputPassword1">Cash Book Closing Balance</label>
                            <div class="input-group">

                                <input type="text" class="form-control" name="cash_closing" id="exampleInputPassword1" placeholder="Enter Cash Book Closing Balance" >
                                <input type="hidden" class="form-control" name="id" id="exampleInputPassword1" value="<?php echo $account['id']; ?>" >
                                <div class="input-group-addon">
                                    <i>Ghc</i>
                                </div>
                            </div>
                        </div>
                </div><!-- /.box-body -->

                <div class="box-footer">
                    <button type="submit" class="btn btn-primary">Next</button>
                </div>
            </form>
        </div><!-- /.box -->
    </div>
</div>