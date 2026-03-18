<?php
/**
 * Created by PhpStorm.
 * User: root
 * Date: 4/23/15
 * Time: 2:29 PM
 */
?>
<div class="row">
    <div class="col-xs-12">
        <div class="box">
            <div class="box-header">
                <h3 class="box-title"><a href="<?php echo base_url(); ?>new_aacount"><button class="btn btn-block btn-primary btn-sm">Add Account</button></a></h3>
            </div><!-- /.box-header -->
            <div class="box-body">
                <table id="example1" class="table table-bordered table-striped">
                    <thead>
                    <tr>
                        <th>Company Name</th>
                        <th>Number Of Accounts</th>
                        <th>Number Users</th>
                        <th>Number Users Left</th>
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
                        <th>Company Name</th>
                        <th>Number Of Accounts</th>
                        <th>Number Users</th>
                        <th>Number Users Left</th>
                        <th>Actions</th>
                    </tr>
                    </tfoot>
                </table>
            </div><!-- /.box-body -->
        </div><!-- /.box -->
    </div><!-- /.col -->
</div><!-- /.row -->