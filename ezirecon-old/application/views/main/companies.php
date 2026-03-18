<?php
/**
 * Created by PhpStorm.
 * User: root
 * Date: 4/23/15
 * Time: 10:08 AM
 */
?>
<div class="row">
    <div class="col-xs-12">
        <div class="box">
            <div class="box-header">
                <h3 class="box-title"><a href="<?php echo base_url(); ?>new_company"><button class="btn btn-block btn-primary btn-sm">Add Company</button></a></h3>
            </div><!-- /.box-header -->
            <div class="ajax_message" id="ajax_message">

            </div>
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
                    <?php
                     foreach($companies as $company):
                    ?>
                    <tr>
                        <td><?php echo $company['name']; ?></td>
                        <td><?php echo( $company['num_accounts']); ?></td>
                        <td><?php echo $company['num_users'] ?></td>
                        <td> <?php echo $company['number_allowed_users']-$company['num_users']; ?></td>
                        <td>
                            <div class="btn-group">
                                <button type="button" class="btn btn-info">Action</button>
                                <button type="button" class="btn btn-info dropdown-toggle" data-toggle="dropdown">
                                    <span class="caret"></span>
                                </button>
                                <ul class="dropdown-menu" role="menu">
                                    <li><a href="<?php echo base_url(); ?>edit_company/<?php echo $company['id']; ?>">Edit</a></li>
<!--                                    <li class="divider"></li>-->
<!--                                    <li><a href="--><?php //echo base_url(); ?><!--view_company/--><?php //echo $company['id']; ?><!--">View</a></li>-->
                                    <li class="divider"></li>
                                    <li><a href="#" onclick="delete_company('<?php echo $company['id']; ?>');">Delete</a></li>
                                    <li class="divider"></li>
                                    <li><a href="<?php echo base_url(); ?>add_company_admin/<?php echo $company['id']; ?>">Add Administrator</a></li>
                                </ul>
                            </div>
                        </td>
                    </tr>
                    <?php
                        endforeach;
                    ?>

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