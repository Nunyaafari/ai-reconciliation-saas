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
                <h3 class="box-title">Transaction  Details</h3>
            </div><!-- /.box-header -->
            <!-- form start -->
            <div class="ajax_message" id="ajax_message">

            </div>
            <form role="form" id="new_setup_transaction" class="new_setup_transaction">
                <div class="box-body">
                    <div class="form-group">
                        <label for="exampleInputEmail1">Narration</label>
                        <input type="text" class="form-control" name="narration" id="exampleInputEmail1" placeholder="Enter transaction narration">
                        <input type="hidden" class="form-control" name="id_account" id="exampleInputEmail1" value="<?php echo $account['id']; ?>">
                        <input type="hidden" class="form-control" name="id_user" id="exampleInputEmail1" value="<?php echo $user_sess['id']; ?>">
                    </div>
                    <div class="form-group">
                        <label for="exampleInputEmail1">Reference</label>
                        <input type="text" class="form-control" name="ref" id="exampleInputEmail1" placeholder="Enter transaction reference">
                    </div>
                    <div class="form-group">
                        <label for="exampleInputPassword1">Amount</label>
                        <input type="text" class="form-control" name="amount" id="exampleInputPassword1" placeholder="Enter amount">
                    </div>
                    <div class="form-group">
                        <label>Date:</label>
                        <div class="input-group">
                            <div class="input-group-addon">
                                <i class="fa fa-calendar"></i>
                            </div>
                            <input id="datemask" type="text" name="date" class="form-control" data-inputmask="'alias': 'yyyy-mm-dd'" data-mask/>
                        </div><!-- /.input group -->
                    </div><!-- /.form group -->

                    <div class="form-group">
                        <label for="exampleInputPassword1">Transaction as per :</label>
                        <select name="transaction_from" class="form-control">
                            <option value="1">
                                Bank Statement
                            </option>
                            <option value="2">
                                Cash Book
                            </option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="exampleInputPassword1">Transaction type :</label>
                        <select name="transaction_type" class="form-control">

                            <option value="1">
                                Debit
                            </option>

                            <option value="2">
                                Credit
                            </option>

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