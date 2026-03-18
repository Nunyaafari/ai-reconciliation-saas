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
                <h3 class="box-title">Company Details</h3>
            </div><!-- /.box-header -->
            <!-- form start -->
            <div class="ajax_message" id="ajax_message">

            </div>
            <form role="form" class="new_company" id="new_company">
                <div class="box-body">
                    <div class="form-group">
                        <label for="exampleInputEmail1">Company Name</label>
                        <input type="text" class="form-control" id="exampleInputEmail1" placeholder="Enter Company Name" name="name">
                    </div>
                    <div class="form-group">
                        <label for="exampleInputEmail1">Acronym</label>
                        <input type="text" class="form-control" id="exampleInputPassword1" placeholder="Enter Company Acronym" name="acronym">
                    </div>
                    <div class="form-group">
                        <label for="exampleInputEmail1">Address</label>
                        <input type="text" class="form-control" id="exampleInputPassword1" placeholder="Enter Company Address" name="address">
                    </div>
                    <div class="form-group">
                        <label for="exampleInputEmail1">Email</label>
                        <input type="email" class="form-control" id="exampleInputPassword1" placeholder="Enter Company Email" name="email">
                    </div>
                    <div class="form-group">
                        <label for="exampleInputEmail1">Account Expiry</label>
                        <input type="text" class="form-control datepick" placeholder="Account Expiry Date" name="expiry">
                    </div><!-- /.box-body -->
                    <div class="form-group">
                        <label for="exampleInputEmail1">Industry</label>
                        <input type="text" class="form-control" id="exampleInputPassword1" placeholder="Enter Company Industry" name="industry">

                </div><!-- /.box-body -->

                <div class="box-footer">
                    <button type="submit" class="btn btn-primary">Submit</button>
                </div>
            </form>
        </div><!-- /.box -->
    </div>
</div>