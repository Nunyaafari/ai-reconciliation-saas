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
                <h3 class="box-title">Edit Company Details</h3>
            </div><!-- /.box-header -->
            <!-- form start -->
            <div class="ajax_message" id="ajax_message">

            </div>
            <form role="form" class="edit_company" id="edit_company">
                <div class="box-body">
                    <div class="form-group">
                        <label for="exampleInputEmail1">Company Name</label>
                        <input type="text" class="form-control" id="exampleInputEmail1" placeholder="Edit Company Name" name="name"  value="<?php echo $company['name']; ?>">
                    </div>
                    <div class="form-group">
                        <label for="exampleInputEmail1">Acronym</label>
                        <input type="text" class="form-control" id="exampleInputPassword1" placeholder="Edit Company Acronym" name="acronym"  value="<?php echo $company['acronym']; ?>">
                    </div>
                    <div class="form-group">
                        <label for="exampleInputEmail1">Address</label>
                        <input type="text" class="form-control" id="exampleInputPassword1" placeholder="Edit Company Address" name="address"  value="<?php echo $company['address']; ?>">
                    </div>
                    <div class="form-group">
                        <label for="exampleInputEmail1">Email</label>
                        <input type="email" class="form-control" id="exampleInputPassword1" placeholder="Edit Company Email" name="email"  value="<?php echo $company['email']; ?>">
                    </div>
                    <div class="form-group">
                        <label for="exampleInputEmail1">Industry</label>
                        <input type="text" class="form-control" id="exampleInputPassword1" placeholder="Edit Company Industry" name="industry"  value="<?php echo $company['industry']; ?>">

                    </div><!-- /.box-body -->
                    <div class="form-group">
                        <label for="exampleInputEmail1">Account Expiry</label>
                        <input type="text" class="form-control datepick" placeholder="Account Expiry Date" name="expiry"  value="<?php echo date('m/d/Y',$company['expiry']); ?>">
                    </div><!-- /.box-body -->
                    <div class="form-group">
                        <label for="exampleInputEmail1">Number OF Allowed Users</label>
                        <input type="text" class="form-control" id="exampleInputPassword1" placeholder="Edit Company Number Of Users" name="number_allowed_users"  value="<?php echo $company['number_allowed_users']; ?>">
                        <input type="hidden" class="form-control" id="exampleInputPassword1" placeholder="Edit Company Number Of Users" name="id" hidden="hidden" value="<?php echo $company['id']; ?>">

                    </div><!-- /.box-body -->

                    <div class="box-footer">
                        <button type="submit" class="btn btn-primary">Submit</button>
                    </div>
            </form>
        </div><!-- /.box -->
    </div>
</div>