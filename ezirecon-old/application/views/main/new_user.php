<?php
/**
 * Created by PhpStorm.
 * User: root
 * Date: 4/23/15
 * Time: 2:21 PM
 */
?>
<div class="row">
    <!-- left column -->
    <div class="col-md-12">
        <!-- general form elements -->
        <div class="box box-primary">
            <div class="box-header">
                <h3 class="box-title"> Add User</h3>
            </div><!-- /.box-header -->
            <!-- form start -->
            <div class="ajax_message" id="ajax_message">

            </div>
            <form role="form" id="new_admin_user" class="new_admin_user">
                <div class="box-body">
                    <div class="form-group">
                        <label for="exampleInputEmail1">Name</label>
                        <input type="text" class="form-control" id="exampleInputEmail1" name="fullname" placeholder="Enter Full Name">
                    </div>
                    <div class="form-group">
                        <label for="exampleInputPassword1">Username</label>
                        <input type="text" class="form-control" id="exampleInputPassword1" name="username" placeholder="Enter Username">
                    </div>
                    <div class="form-group">
                        <label for="exampleInputPassword1">Password</label>
                        <input type="password" class="form-control" id="exampleInputPassword1" name="password" placeholder="Password">
                    </div>
                    <div class="form-group">
                        <label for="exampleInputPassword1">Confirm Password</label>
                        <input type="password" class="form-control" id="exampleInputPassword1" name="confirm_password" placeholder="Confirm Password">
                        <input type="hidden" class="form-control" id="exampleInputPassword1" name="id" placeholder="" value="<?php echo $user_sess['id_company']; ?>">
                    </div>
                </div><!-- /.box-body -->

                <div class="box-footer">
                    <button type="submit" class="btn btn-primary">Submit</button>
                </div>
            </form>
        </div><!-- /.box -->
    </div>
</div>
