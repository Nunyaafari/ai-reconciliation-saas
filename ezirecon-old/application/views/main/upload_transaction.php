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
                <h3 class="box-title">Upload Excel File</h3>
            </div><!-- /.box-header -->
            <!-- form start -->
            <div class="ajax_message" id="ajax_message">

            </div>
            <form role="form" id="new_transaction" class="new_transaction" enctype="multipart/form-data">
                <div class="box-body">
                        <input type="hidden" class="form-control" name="id_account" id="exampleInputEmail1" value="<?php echo $account['id']; ?>">
                        <input type="hidden" class="form-control" name="id_user" id="exampleInputEmail1" value="<?php echo $user_sess['id']; ?>">

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
                    <div class="form-group">
                        <label for="exampleInputFile">Upload Your Excel File</label>
                        <input type="file" name="userfile" id="exampleInputFile">
                        <p class="help-block">New Excel</p>
                    </div>
                </div><!-- /.box-body -->
                <div class="box-footer">
                    <button type="submit" class="btn btn-primary">Submit</button>
                </div>
            </form>
        </div><!-- /.box -->
    </div>
</div>