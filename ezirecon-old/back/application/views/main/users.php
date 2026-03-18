<?php
/**
 * Created by PhpStorm.
 * User: root
 * Date: 4/23/15
 * Time: 2:17 PM
 */
?>
<div class="row">
    <div class="col-xs-12">
        <div class="box">
            <div class="box-header">
                <h3 class="box-title"><a href="<?php echo base_url(); ?>new_system_admin"><button class="btn btn-block btn-primary btn-sm">Add System Administrator</button></a></h3>
                <h3 class="box-title"><a href="<?php echo base_url(); ?>new_user"><button class="btn btn-block btn-primary btn-sm">Add User</button></a></h3>
            </div><!-- /.box-header -->
            <div class="box-body">
                <table id="example1" class="table table-bordered table-striped">
                    <thead>
                    <tr>
                        <th>Name</th>
                        <th>Company</th>
                        <th>Number of accounts</th>
                        <th>Last Login</th>
                        <th>Actions</th>
                    </tr>
                    </thead>
                    <tbody>
                    <tr>
                        <td>Dream Code</td>
                        <td>100</td>
                        <td>5</td>
                        <td> 4</td>
                        <td>
                            <div class="btn-group">
                                <button type="button" class="btn btn-info">Action</button>
                                <button type="button" class="btn btn-info dropdown-toggle" data-toggle="dropdown">
                                    <span class="caret"></span>
                                </button>
                                <ul class="dropdown-menu" role="menu">
                                    <li><a href="#">Edit</a></li>
                                    <li class="divider"></li>
                                    <li><a href="#">View</a></li>
                                    <li class="divider"></li>
                                    <li><a href="#">Delete</a></li>
                                </ul>
                            </div>
                        </td>
                    </tr>

                    </tbody>
                    <tfoot>
                    <tr>
                        <th>Name</th>
                        <th>Company</th>
                        <th>Number of accounts</th>
                        <th>Last Login</th>
                        <th>Actions</th>
                    </tr>
                    </tfoot>
                </table>
            </div><!-- /.box-body -->
        </div><!-- /.box -->
    </div><!-- /.col -->
</div><!-- /.row -->