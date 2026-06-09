<div class="threads index">
    <h2><?php echo __('Threads'); ?></h2>
    <table>
        <thead>
            <tr>
                <th><?php echo $this->Paginator->sort('title'); ?></th>
                <th><?php echo $this->Paginator->sort('User.name', __('Author')); ?></th>
                <th><?php echo $this->Paginator->sort('status'); ?></th>
                <th><?php echo $this->Paginator->sort('created'); ?></th>
                <th class="actions"><?php echo __('Actions'); ?></th>
            </tr>
        </thead>
        <tbody>
            <?php foreach ($threads as $thread): ?>
            <tr>
                <td>
                    <?php echo $this->Html->link(
                        h($thread['Thread']['title']),
                        array('action' => 'view', $thread['Thread']['id'])
                    ); ?>
                    <?php foreach ($thread['Tag'] as $tag): ?>
                        <span class="tag"><?php echo h($tag['name']); ?></span>
                    <?php endforeach; ?>
                </td>
                <td><?php echo h($thread['User']['name']); ?></td>
                <td><?php echo h($thread['Thread']['status']); ?></td>
                <td><?php echo h($thread['Thread']['created']); ?></td>
                <td class="actions">
                    <?php echo $this->Html->link(__('View'), array('action' => 'view', $thread['Thread']['id'])); ?>
                    <?php echo $this->Html->link(__('Edit'), array('action' => 'edit', $thread['Thread']['id'])); ?>
                    <?php echo $this->Form->postLink(__('Delete'),
                        array('action' => 'delete', $thread['Thread']['id']),
                        array('confirm' => __('Are you sure?'))
                    ); ?>
                </td>
            </tr>
            <?php endforeach; ?>
        </tbody>
    </table>
    <div class="paging">
        <?php echo $this->Paginator->prev('< ' . __('previous')); ?>
        <?php echo $this->Paginator->numbers(); ?>
        <?php echo $this->Paginator->next(__('next') . ' >'); ?>
    </div>
</div>
